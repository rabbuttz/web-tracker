import express from 'express';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { createArkitSetup } from './arkit-setup.mjs';

const WEB_PORT = 3000;
const DEFAULT_RESONITE_PORT = 10534;
const RESONITE_LINK_REFUSED_MESSAGE = 'ResoniteLinkが有効になっていない、またはResoniteLink Port番号が間違っています。ダッシュメニュー→セッションタブの左下からResoniteLinkを有効にしてください。セッションのホストである必要があります。 Check the ResoniteLink status or the Port Number.';

const isConnectionRefusedError = (error) => {
    if (!error) return false;
    if (error.code === 'ECONNREFUSED') return true;
    const nestedErrors = Array.isArray(error.errors) ? error.errors : [];
    if (nestedErrors.some(err => err?.code === 'ECONNREFUSED')) return true;
    return typeof error.message === 'string' && error.message.includes('ECONNREFUSED');
};

// ============================================
// ResoniteLink Client
// ============================================
class ResoniteLinkClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.isConnected = false;
        this.pendingRequests = new Map();
        this.requestTimeout = 30000;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.on('open', () => {
                this.isConnected = true;
                console.log('[ResoniteLink] Connected');
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('close', () => {
                this.isConnected = false;
                console.log('[ResoniteLink] Disconnected');
            });

            this.ws.on('error', (error) => {
                console.error('[ResoniteLink] Error:', error.message);
                if (!this.isConnected) {
                    reject(error);
                }
            });
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    handleMessage(data) {
        try {
            const response = JSON.parse(data.toString());
            const pending = this.pendingRequests.get(response.sourceMessageId);
            if (pending) {
                this.pendingRequests.delete(response.sourceMessageId);
                pending.resolve(response);
            }
        } catch (error) {
            console.error('[ResoniteLink] Parse error:', error);
        }
    }

    async sendMessage(message) {
        if (!this.ws || !this.isConnected) {
            throw new Error('Not connected to ResoniteLink');
        }

        // Debug logging for updateComponent messages
        if (message.$type === 'updateComponent' && message.data?.members?.Target) {
            console.log(`[ResoniteLink] Sending updateComponent message:`);
            console.log(`[ResoniteLink]   Full message: ${JSON.stringify(message, null, 2)}`);
        }

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(message.messageId);
                reject(new Error('Request timeout'));
            }, this.requestTimeout);

            this.pendingRequests.set(message.messageId, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    // Debug logging for responses
                    if (message.$type === 'updateComponent' && message.data?.members?.Target) {
                        console.log(`[ResoniteLink] Received response: ${JSON.stringify(response, null, 2)}`);
                    }
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            this.ws.send(JSON.stringify(message));
        });
    }

    async getSlot(slotId, depth = 0, includeComponentData = false) {
        return this.sendMessage({
            $type: 'getSlot',
            messageId: uuidv4(),
            slotId,
            depth,
            includeComponentData
        });
    }

    async updateComponent(componentId, members) {
        return this.sendMessage({
            $type: 'updateComponent',
            messageId: uuidv4(),
            data: {
                id: componentId,
                members
            }
        });
    }

    async getComponent(componentId) {
        return this.sendMessage({
            $type: 'getComponent',
            messageId: uuidv4(),
            componentId
        });
    }

    async addComponent(slotId, componentType, members = {}, componentId = null) {
        return this.sendMessage({
            $type: 'addComponent',
            messageId: uuidv4(),
            containerSlotId: slotId,
            data: {
                componentType,
                members,
                id: componentId
            }
        });
    }

    async removeComponent(componentId) {
        return this.sendMessage({
            $type: 'removeComponent',
            messageId: uuidv4(),
            componentId
        });
    }
}

let resoniteClient = null;
let currentResonitePort = null;
let isSettingUp = false;
let lastResoniteSignalAt = 0;
let lastResoniteSignalMode = 'unknown';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
});

const CONTROL_QUEUE_MAX = 100;
const controlCommands = [];

function enqueueControlCommand(command) {
    if (controlCommands.length >= CONTROL_QUEUE_MAX) {
        controlCommands.shift();
    }
    controlCommands.push({ ...command, queuedAt: Date.now() });
}

function normalizeResoniteModeParam(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return 'unknown';
    if (['vr', 'virtual', 'steamvr', 'oculus', 'openxr'].includes(raw)) return 'vr';
    if (['desktop', 'desk', 'flat', 'nonvr', 'non-vr', 'monitor'].includes(raw)) return 'desktop';
    if (['1', 'true', 'yes'].includes(raw)) return 'vr';
    if (['0', 'false', 'no'].includes(raw)) return 'desktop';
    return 'unknown';
}

function resolveResoniteMode(query) {
    const modeParam = normalizeResoniteModeParam(query.mode);
    if (modeParam !== 'unknown') return modeParam;
    const vrParam = normalizeResoniteModeParam(query.vr ?? query.isVr ?? query.isVR);
    return vrParam;
}

function sendResoniteSignal(mode) {
    lastResoniteSignalAt = Date.now();
    lastResoniteSignalMode = mode || 'unknown';
    if (typeof process.send === 'function') {
        process.send({ type: 'resonite-signal', mode: lastResoniteSignalMode, at: lastResoniteSignalAt });
    }
}

// Helper functions (extracted from ResoniteLink logic)
function getSlotName(slot) {
    if (!slot) return '';
    return typeof slot.name === 'string' ? slot.name : (slot.name?.value || '');
}

function findChildByName(slot, name) {
    if (!slot || !slot.children) return null;
    return slot.children.find(child => getSlotName(child) === name);
}

const arkitSetup = createArkitSetup({
    ResoniteLinkClient,
    defaultResonitePort: DEFAULT_RESONITE_PORT,
    getSlotName,
    findChildByName,
    getResoniteClient: () => resoniteClient,
    setResoniteClient: (client) => { resoniteClient = client; },
    getCurrentResonitePort: () => currentResonitePort,
    setCurrentResonitePort: (port) => { currentResonitePort = port; },
    getIsSettingUp: () => isSettingUp,
    setIsSettingUp: (value) => { isSettingUp = value; }
});

arkitSetup.registerArkitRoutes(app);

app.get('/resonite-signal', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const mode = resolveResoniteMode(req.query);
    sendResoniteSignal(mode);
    res.json({ ok: true, mode });
});

app.get('/resonite-signal-status', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        ok: true,
        mode: lastResoniteSignalMode,
        lastSignalAt: lastResoniteSignalAt
    });
});

app.get('/calibrate', (req, res) => {
    const type = String(req.query.type || '').toLowerCase();
    if (type !== 'head' && type !== 'hand') {
        res.status(400).send('type must be head or hand');
        return;
    }
    enqueueControlCommand({ type: 'calibrate', target: type });
    res.send('OK');
});

app.get('/auto-calibrate', (req, res) => {
    const enabledParam = String(req.query.enabled || '').toLowerCase();
    if (enabledParam !== 'true' && enabledParam !== 'false') {
        res.status(400).send('enabled must be true or false');
        return;
    }
    enqueueControlCommand({ type: 'auto-calibrate', enabled: enabledParam === 'true' });
    res.send('OK');
});

app.get('/control-commands', (req, res) => {
    const pending = controlCommands.splice(0, controlCommands.length);
    res.json(pending);
});

// Setup EyeManager to disable auto-blink by setting MinBlinkInterval to Infinity
// Setup Mouth shape keys from DirectVisemeDriver
async function setupMouthShapeKeys(client, avatarSlot, faceTrackSlot) {
    console.log('[Mouth Setup] Starting...');

    // Find Mouth slot in FaceTrack
    const mouthSlot = findChildByName(faceTrackSlot, 'Mouth');
    if (!mouthSlot) {
        console.log('[Mouth Setup] ERROR: Mouth slot not found in FaceTrack');
        return ' (Mouth slot not found in FaceTrack / FaceTrack 内に Mouth スロットが見つかりませんでした)';
    }

    console.log(`[Mouth Setup] Getting Mouth slot details (ID: ${mouthSlot.id})...`);
    // Get Mouth slot with component data
    const mouthDetail = await client.getSlot(mouthSlot.id, 0, true);
    console.log(`[Mouth Setup] Mouth detail success: ${mouthDetail.success}`);
    if (!mouthDetail.success || !mouthDetail.data.components) {
        return ' (Failed to get Mouth slot details / Mouth スロット（インストーラー内部）の詳細取得に失敗しました)';
    }

    console.log(`[Mouth Setup] Getting avatar children (ID: ${avatarSlot.id})...`);
    // Find CenteredRoot to search for DirectVisemeDriver
    const avatarChildren = await client.getSlot(avatarSlot.id, 1, false);
    if (!avatarChildren.success) {
        return ' (Failed to get avatar children / アバターの子スロット取得に失敗しました)';
    }

    const centeredRoot = avatarChildren.data.children?.find(c => getSlotName(c).includes('CenteredRoot'));
    if (!centeredRoot) {
        return ' (CenteredRoot not found in avatar / アバター内に CenteredRoot が見つかりませんでした)';
    }

    console.log(`[Mouth Setup] Getting CenteredRoot children (ID: ${centeredRoot.id})...`);
    const centeredRootChildren = await client.getSlot(centeredRoot.id, 1, false);
    if (!centeredRootChildren.success) {
        return ' (Failed to get CenteredRoot children / CenteredRoot の子スロット取得に失敗しました)';
    }
    console.log(`[Mouth Setup] CenteredRoot children count: ${centeredRootChildren.data.children?.length || 0}`);

    let slotsToSearch = [];
    const rootNode = centeredRootChildren.data.children?.find(c => {
        const name = getSlotName(c);
        return name.includes('RootNode') && !name.includes('Armature');
    });

    if (rootNode) {
        const rootNodeChildren = await client.getSlot(rootNode.id, 1, false);
        if (rootNodeChildren.success && rootNodeChildren.data.children) {
            slotsToSearch = rootNodeChildren.data.children.filter(c => !getSlotName(c).includes('Armature'));
        }
    }

    const centeredRootNonArmature = centeredRootChildren.data.children?.filter(c => {
        const name = getSlotName(c);
        return !name.includes('Armature') && !name.includes('RootNode');
    }) || [];

    slotsToSearch = [...slotsToSearch, ...centeredRootNonArmature];

    if (slotsToSearch.length === 0) {
        return ' (No mesh slots found / メッシュスロットが見つかりませんでした)';
    }

    console.log(`[Mouth Setup] Searching for DirectVisemeDriver in ${slotsToSearch.length} slots...`);
    let visemeComponent = null;
    for (const childSlot of slotsToSearch) {
        console.log(`[Mouth Setup] Checking slot: ${getSlotName(childSlot)} (${childSlot.id})`);
        const slotDetail = await client.getSlot(childSlot.id, 0, true);
        if (!slotDetail.success || !slotDetail.data.components) continue;

        const found = slotDetail.data.components.find(c => {
            const compType = c.type || c.componentType || '';
            return compType.includes('DirectVisemeDriver');
        });

        if (found) {
            console.log(`[Mouth Setup] Found DirectVisemeDriver in slot: ${getSlotName(childSlot)}`);

            // Log all components on this slot to find SkinnedMeshRenderer
            console.log(`[Mouth Setup] Components on slot ${getSlotName(childSlot)}:`);
            for (const comp of slotDetail.data.components) {
                const type = comp.type || comp.componentType || '';
                console.log(`  - ${type} (ID: ${comp.id})`);
                if (type.includes('SkinnedMeshRenderer')) {
                    const smrDetail = await client.getComponent(comp.id);
                    if (smrDetail.success) {
                        console.log(`    SMR members: ${Object.keys(smrDetail.data.members).filter(k => k.includes('BlendShape')).join(', ')}`);
                    }
                }
            }

            visemeComponent = found;
            break;
        }
    }

    if (!visemeComponent) {
        return ' (DirectVisemeDriver not found / DirectVisemeDriver が見つかりませんでした)';
    }

    // Find SkinnedMeshRenderer to get actual blend shape references
    console.log('[Mouth Setup] Finding SkinnedMeshRenderer for blend shapes...');
    let skinnedMeshRenderer = null;
    for (const childSlot of slotsToSearch) {
        const slotDetail = await client.getSlot(childSlot.id, 0, true);
        if (!slotDetail.success || !slotDetail.data.components) continue;

        const smr = slotDetail.data.components.find(c => {
            const compType = c.type || c.componentType || '';
            return compType.includes('SkinnedMeshRenderer');
        });

        if (smr) {
            console.log(`[Mouth Setup] Found SkinnedMeshRenderer in slot: ${getSlotName(childSlot)}`);

            const smrDetail = await client.getComponent(smr.id);
            if (smrDetail.success) {
                skinnedMeshRenderer = smrDetail.data;
                console.log(`[Mouth Setup] SkinnedMeshRenderer members: ${Object.keys(smrDetail.data.members).filter(k => k.includes('BlendShape')).join(', ')}`);
                break;
            }
        }
    }

    if (!skinnedMeshRenderer) {
        console.log('[Mouth Setup] WARNING: SkinnedMeshRenderer not found, will try to use DirectVisemeDriver targets');
    }

    console.log(`[Mouth Setup] Getting DirectVisemeDriver details (ID: ${visemeComponent.id})...`);
    const visemeDetail = await client.getComponent(visemeComponent.id);
    console.log(`[Mouth Setup] DirectVisemeDriver detail success: ${visemeDetail.success}`);
    if (!visemeDetail.success) {
        return ' (Failed to get DirectVisemeDriver details / DirectVisemeDriver の詳細取得に失敗しました)';
    }

    const visemeMembers = visemeDetail.data.members;
    console.log(`[Mouth Setup] Viseme members keys: ${Object.keys(visemeMembers).join(', ')}`);
    // Check structure of one member
    if (visemeMembers.aa) {
        console.log(`[Mouth Setup] Member 'aa' structure: ${JSON.stringify(visemeMembers.aa)}`);
    }

    const visemeToMouthMapping = {
        'aa': 'aa_shape',
        'E': 'E_shape',
        'ih': 'ih_shape',
        'oh': 'oh_shape',
        'ou': 'ou_shape'
    };

    // Phase 0: Save shape key field IDs
    console.log('[Mouth Setup] Phase 0: Saving shape key field IDs...');
    const savedShapeKeyFieldIds = {};

    // First try to get them from SkinnedMeshRenderer if we found it
    if (skinnedMeshRenderer && skinnedMeshRenderer.members) {
        console.log('[Mouth Setup] Attempting to get shape keys from SkinnedMeshRenderer...');
        for (const [visemeField, mouthVarName] of Object.entries(visemeToMouthMapping)) {
            // Look for a member that matches the viseme name (case-insensitive)
            const smrMemberKey = Object.keys(skinnedMeshRenderer.members).find(k =>
                k.toLowerCase() === visemeField.toLowerCase() ||
                k.toLowerCase() === `blendshape.${visemeField.toLowerCase()}` ||
                k.toLowerCase() === `_blendshape.${visemeField.toLowerCase()}`
            );

            if (smrMemberKey) {
                savedShapeKeyFieldIds[visemeField] = skinnedMeshRenderer.members[smrMemberKey].id;
                console.log(`[Mouth Setup] Found ${visemeField} in SMR: ${smrMemberKey} -> ${savedShapeKeyFieldIds[visemeField]}`);
            }
        }
    }

    // Fallback/supplement from DirectVisemeDriver if missing
    for (const [visemeField, mouthVarName] of Object.entries(visemeToMouthMapping)) {
        if (savedShapeKeyFieldIds[visemeField]) continue;

        const visemeMember = visemeMembers[visemeField];
        if (visemeMember?.targetId) {
            // If it's already a dummy, don't use it!
            const isDummy = visemeMember.targetType?.includes('DynamicValueVariable');
            if (isDummy) {
                console.log(`[Mouth Setup] Skipping ${visemeField} from VisemeDriver as it already points to a dummy.`);
                continue;
            }
            savedShapeKeyFieldIds[visemeField] = visemeMember.targetId;
            console.log(`[Mouth Setup] Saved ${visemeField} from VisemeDriver target -> ${visemeMember.targetId}`);
        }
    }
    console.log(`[Mouth Setup] Final saved shape keys: ${JSON.stringify(savedShapeKeyFieldIds)}`);

    // Phase 1: Find dummy variables
    console.log('[Mouth Setup] Phase 1: Finding dummy variables...');
    const dummyVariables = {};
    for (const comp of mouthDetail.data.components) {
        const compType = comp.type || comp.componentType || '';
        if (compType.includes('DynamicValueVariable<float>')) {
            const compDetail = await client.getComponent(comp.id);
            if (compDetail.success && compDetail.data.members?.VariableName) {
                const varName = compDetail.data.members.VariableName.value;
                const valueFieldId = compDetail.data.members.Value?.id;
                console.log(`[Mouth Setup] Found dummy variable: ${varName} (ID: ${valueFieldId})`);
                dummyVariables[varName] = {
                    componentId: comp.id,
                    valueFieldId: valueFieldId
                };
            }
        }
    }
    console.log(`[Mouth Setup] All dummy variables: ${JSON.stringify(Object.keys(dummyVariables))}`);

    // Phase 2: Redirect DirectVisemeDriver to dummies (frees up the shape keys!)
    console.log('[Mouth Setup] Phase 2: Redirecting DirectVisemeDriver to dummy variables...');
    const visemeUpdateResults = [];
    for (const visemeField of Object.keys(visemeToMouthMapping)) {
        const visemeFieldId = visemeMembers[visemeField]?.id;

        // Find matching dummy variable
        const possibleDummyNames = [
            `${visemeField}_dummy`,
            `${visemeField}_shape`,
            visemeField === 'aa' ? 'a_dummy' : null,
            visemeField === 'ih' ? 'i_dummy' : null,
            visemeField === 'ou' ? 'u_dummy' : null,
            visemeField === 'E' ? 'e_dummy' : null,
            visemeField === 'oh' ? 'o_dummy' : null,
        ].filter(Boolean);

        let dummyVar = null;
        for (const name of possibleDummyNames) {
            if (dummyVariables[name]) {
                dummyVar = dummyVariables[name];
                console.log(`[Mouth Setup] Map ${visemeField} -> ${name}`);
                break;
            }
        }

        if (!visemeFieldId || !dummyVar || !dummyVar.valueFieldId) {
            console.log(`[Mouth Setup] SKIPPED redirection: ${visemeField} (Dummy exists: ${!!dummyVar}, FieldID exists: ${!!visemeFieldId})`);
            continue;
        }

        try {
            console.log(`[Mouth Setup] Redirecting VisemeDriver.${visemeField} -> Dummy Value...`);
            const updateResult = await client.updateComponent(visemeComponent.id, {
                [visemeField]: {
                    $type: 'reference',
                    targetId: dummyVar.valueFieldId
                }
            });
            visemeUpdateResults.push({ field: visemeField, success: updateResult.success });
            console.log(`[Mouth Setup]   Success: ${updateResult.success}`);
        } catch (err) {
            console.error(`[Mouth Setup] Error redirecting ${visemeField}:`, err.message);
            visemeUpdateResults.push({ field: visemeField, success: false });
        }
    }
    console.log(`[Mouth Setup] Phase 2 results: ${JSON.stringify(visemeUpdateResults)}`);

    // Phase 3: Find DynamicValueVariableDrivers
    console.log('[Mouth Setup] Phase 3: Finding DynamicValueVariableDrivers...');
    const mouthDrivers = {};
    for (const comp of mouthDetail.data.components) {
        const compType = comp.type || comp.componentType || '';
        if (compType.includes('DynamicValueVariableDriver<float>')) {
            const compDetail = await client.getComponent(comp.id);
            if (compDetail.success && compDetail.data.members?.VariableName) {
                const varName = compDetail.data.members.VariableName.value;
                const targetId = compDetail.data.members.Target?.id;
                console.log(`[Mouth Setup] Found DynamicValueVariableDriver: varName="${varName}", Target.id="${targetId}"`);
                mouthDrivers[varName] = {
                    componentId: comp.id,
                    targetId: targetId
                };
            }
        }
    }
    console.log(`[Mouth Setup] Discovered drivers: ${JSON.stringify(Object.keys(mouthDrivers))}`);

    // Phase 4: Assign saved shape keys to DynamicValueVariableDrivers
    console.log(`[Mouth Setup] Phase 4: Assigning saved shape keys to DynamicValueVariableDrivers...`);

    const mouthUpdateResults = [];
    for (const [visemeField, mouthVarName] of Object.entries(visemeToMouthMapping)) {
        console.log(`[Mouth Setup] --- Processing: visemeField="${visemeField}" -> mouthVarName="${mouthVarName}" ---`);

        const mouthDriver = mouthDrivers[mouthVarName];
        if (!mouthDriver) {
            console.log(`[Mouth Setup] SKIPPED: ${visemeField} (DynamicValueVariableDriver "${mouthVarName}" not found)`);
            continue;
        }

        // Use the SAVED shape key field ID
        const shapeKeyTargetId = savedShapeKeyFieldIds[visemeField];
        if (!shapeKeyTargetId) {
            console.log(`[Mouth Setup] SKIPPED: ${visemeField} (No saved shape key field ID)`);
            mouthUpdateResults.push({ field: visemeField, success: false });
            continue;
        }

        console.log(`[Mouth Setup] Using SAVED shape key for "${visemeField}": ${shapeKeyTargetId}`);

        try {
            const updatePayload = {
                Target: {
                    $type: 'reference',
                    targetId: shapeKeyTargetId
                }
            };
            console.log(`[Mouth Setup] Sending updateComponent for ${mouthVarName}:`);
            console.log(`[Mouth Setup]   componentId: "${mouthDriver.componentId}"`);
            console.log(`[Mouth Setup]   Assigning shape key "${shapeKeyTargetId}" to Target`);
            console.log(`[Mouth Setup]   payload: ${JSON.stringify(updatePayload, null, 2)}`);
            const updateResult = await client.updateComponent(mouthDriver.componentId, updatePayload);
            console.log(`[Mouth Setup]   updateComponent result: success=${updateResult.success}, data=${JSON.stringify(updateResult.data)}`);

            // Verify the assignment
            if (updateResult.success) {
                const verifyResult = await client.getComponent(mouthDriver.componentId);
                if (verifyResult.success) {
                    const actualTarget = verifyResult.data.members?.Target?.targetId;
                    console.log(`[Mouth Setup]   VERIFY: Target is now pointing to: "${actualTarget}"`);
                    console.log(`[Mouth Setup]   VERIFY: Expected: "${shapeKeyTargetId}", Match: ${actualTarget === shapeKeyTargetId}`);
                }
            }

            mouthUpdateResults.push({ field: visemeField, success: updateResult.success });
        } catch (err) {
            console.error(`[Mouth Setup] Error linking ${visemeField}:`, err.message);
            console.error(`[Mouth Setup]   stack:`, err.stack);
            mouthUpdateResults.push({ field: visemeField, success: false });
        }
    }
    console.log(`[Mouth Setup] Phase 4 results: ${JSON.stringify(mouthUpdateResults)}`);

    const mouthSuccessCount = mouthUpdateResults.filter(r => r.success).length;
    const visemeSuccessCount = visemeUpdateResults.filter(r => r.success).length;

    let resultMsg = '';
    if (mouthSuccessCount > 0) resultMsg += ` Mouth: ${mouthSuccessCount} shape keys linked.`;
    if (visemeSuccessCount > 0) resultMsg += ` Viseme: ${visemeSuccessCount} redirected to dummy.`;
    return resultMsg || ' Mouth: no changes made.';


}

// FaceTrack Setup API
app.get('/setup-facetrack', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const username = req.query.username;
    const rawPort = parseInt(req.query.port) || DEFAULT_RESONITE_PORT;
    const port = (rawPort >= 1 && rawPort <= 65535) ? rawPort : DEFAULT_RESONITE_PORT;
    const arkitParam = req.query.arkit;
    const runArkit = arkitParam === undefined
        ? true
        : !['0', 'false', 'no'].includes(String(arkitParam).toLowerCase());
    const arkitLimit = req.query.arkitLimit ? parseInt(req.query.arkitLimit, 10) : undefined;
    const arkitBatch = req.query.arkitBatch ? parseInt(req.query.arkitBatch, 10) : undefined;
    const arkitDebugSelf = req.query.arkitDebugSelf === '1';
    const arkitNoType = req.query.arkitNoType === '1';

    if (!username) {
        return res.status(400).send("Error: Username parameter required / エラー: usernameパラメータが必須です。");
    }

    if (isSettingUp) {
        return res.send("Error: Setup is already in progress. / エラー: セットアップが既に進行中です。");
    }

    isSettingUp = true;
    console.log(`[FaceTrack] Starting setup for user: ${username} (port: ${port})`);

    try {
        if (!resoniteClient || !resoniteClient.isConnected || currentResonitePort !== port) {
            if (resoniteClient) resoniteClient.disconnect();
            const wsUrl = `ws://localhost:${port}`;
            console.log(`[FaceTrack] Connecting to ResoniteLink at ${wsUrl}...`);
            resoniteClient = new ResoniteLinkClient(wsUrl);
            await resoniteClient.connect();
            currentResonitePort = port;
            console.log('[FaceTrack] Connection established');
        }

        console.log('[FaceTrack] Requesting Root slot...');
        // First try depth=1 (direct children only)
        let rootResponse = await Promise.race([
            resoniteClient.getSlot('Root', 1, false),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Root slot request timed out after 10 seconds. Is Resonite running and ResoniteLink mod enabled?')), 10000))
        ]);
        console.log(`[FaceTrack] Root slot response received: success=${rootResponse.success}`);
        if (!rootResponse.success) throw new Error('Failed to get root slot');

        console.log(`[FaceTrack] Searching for user: ${username}...`);
        console.log(`[FaceTrack] Root has ${rootResponse.data.children?.length || 0} direct children`);

        // Collect all candidate slots matching the user name pattern
        const SKIP_SLOTS = ['Undo Manager', '__TEMP'];
        const findUserSlotCandidates = (slot, depth = 0) => {
            const results = [];
            const name = getSlotName(slot);
            const indent = '  '.repeat(depth);
            console.log(`[FaceTrack] ${indent}Checking: "${name}"`);

            if (SKIP_SLOTS.includes(name)) {
                console.log(`[FaceTrack] ${indent}-> Skipping (system slot)`);
                return results;
            }

            if (name.includes(username) && name.startsWith('User')) {
                console.log(`[FaceTrack] ${indent}-> Name match!`);
                results.push(slot);
            }

            if (slot.children) {
                for (const child of slot.children) {
                    results.push(...findUserSlotCandidates(child, depth + 1));
                }
            }
            return results;
        };

        // Verify a candidate has UserRoot component (real user slot)
        const verifyUserSlot = async (candidate) => {
            const detail = await resoniteClient.getSlot(candidate.id, 0, true);
            if (!detail.success || !detail.data.components) return false;
            return detail.data.components.some(c =>
                (c.type || c.componentType || '').includes('UserRoot')
            );
        };

        let candidates = findUserSlotCandidates(rootResponse.data);

        // If no candidates in depth=1, try deeper search (depth=3)
        if (candidates.length === 0) {
            console.log('[FaceTrack] User not found in depth=1, searching deeper (depth=3)...');
            rootResponse = await resoniteClient.getSlot('Root', 3, false);
            if (rootResponse.success) {
                candidates = findUserSlotCandidates(rootResponse.data);
            }
        }

        // Verify candidates have UserRoot component
        let userSlot = null;
        for (const candidate of candidates) {
            console.log(`[FaceTrack] Verifying candidate: ${getSlotName(candidate)} (${candidate.id})...`);
            if (await verifyUserSlot(candidate)) {
                console.log(`[FaceTrack] -> Confirmed (has UserRoot component)`);
                userSlot = candidate;
                break;
            }
            console.log(`[FaceTrack] -> Rejected (no UserRoot component)`);
        }

        if (!userSlot) {
            return res.send(`Error: User "${username}" not found. / エラー: "${username}" というユーザーが見つかりませんでした。`);
        }

        console.log(`[FaceTrack] Found user slot: ${getSlotName(userSlot)} (${userSlot.id})`);
        console.log('[FaceTrack] Getting user slot details (depth 10)...');
        const userDeepResponse = await Promise.race([
            resoniteClient.getSlot(userSlot.id, 10, false),
            new Promise((_, reject) => setTimeout(() => reject(new Error('User slot request timed out after 30 seconds')), 30000))
        ]);
        console.log(`[FaceTrack] User slot details received: success=${userDeepResponse.success}`);
        if (!userDeepResponse.success) throw new Error('Failed to get user slot children');

        console.log('[FaceTrack] Searching for FaceTrack_ver slot...');
        const findFaceTrackSlot = (slot, depth = 0) => {
            const name = getSlotName(slot);
            const indent = '  '.repeat(depth);
            console.log(`[FaceTrack] ${indent}Checking: "${name}"`);
            if (name.includes('FaceTrack_ver')) {
                console.log(`[FaceTrack] ${indent}-> MATCH!`);
                return slot;
            }
            if (slot.children) {
                for (const child of slot.children) {
                    const found = findFaceTrackSlot(child, depth + 1);
                    if (found) return found;
                }
            }
            return null;
        };

        const faceTrackSlot = findFaceTrackSlot(userDeepResponse.data);
        if (!faceTrackSlot) {
            console.log('[FaceTrack] ERROR: FaceTrack_ver slot not found!');
            return res.send(`Error: FaceTrack_ver slot not found under user "${username}". / エラー: "${username}" の下に FaceTrack_ver スロットが見つかりませんでした。`);
        }

        console.log(`[FaceTrack] Found FaceTrack slot: ${getSlotName(faceTrackSlot)} (${faceTrackSlot.id})`);

        console.log('[FaceTrack] Getting FaceTrack slot details...');
        const faceTrackDetail = await resoniteClient.getSlot(faceTrackSlot.id, 2, true);
        console.log(`[FaceTrack] FaceTrack detail success: ${faceTrackDetail.success}`);
        if (!faceTrackDetail.success) throw new Error('Failed to get FaceTrack slot details');

        console.log('[FaceTrack] Getting parent (avatar) slot...');
        const parentId = faceTrackDetail.data.parent?.targetId;
        if (!parentId) {
            console.log('[FaceTrack] ERROR: No parent found!');
            return res.send("Error: FaceTrack parent (avatar) not found. / エラー: FaceTrack の親（アバター）が見つかりませんでした。");
        }

        console.log(`[FaceTrack] Getting avatar slot (ID: ${parentId})...`);
        const avatarResponse = await resoniteClient.getSlot(parentId, 3, true);
        console.log(`[FaceTrack] Avatar response success: ${avatarResponse.success}`);
        if (!avatarResponse.success) throw new Error('Failed to get avatar slot');

        const avatarSlot = avatarResponse.data;
        console.log(`[FaceTrack] Found avatar: ${getSlotName(avatarSlot)} (${avatarSlot.id})`);

        // Finding Proxies (From server-example.js)
        const headProxy = findChildByName(avatarSlot, 'Head Proxy');
        const leftHandProxy = findChildByName(avatarSlot, 'Left Hand Proxy');
        const rightHandProxy = findChildByName(avatarSlot, 'Right Hand Proxy');

        if (!headProxy || !leftHandProxy || !rightHandProxy) {
            const missing = [];
            if (!headProxy) missing.push("Head Proxy");
            if (!leftHandProxy) missing.push("Left Hand Proxy");
            if (!rightHandProxy) missing.push("Right Hand Proxy");
            return res.send(`Error: Missing proxies: ${missing.join(", ")}. / エラー: 以下のプロキシが見つかりません: ${missing.join(", ")}`);
        }

        console.log(`[FaceTrack] Head Proxy children: ${headProxy.children?.map(c => getSlotName(c)).join(', ') || 'none'}`);
        console.log(`[FaceTrack] Left Hand Proxy children: ${leftHandProxy.children?.map(c => getSlotName(c)).join(', ') || 'none'}`);
        console.log(`[FaceTrack] Right Hand Proxy children: ${rightHandProxy.children?.map(c => getSlotName(c)).join(', ') || 'none'}`);

        let headTargetId = findChildByName(headProxy, 'TargetProxy')?.id;
        let leftHandTargetProxyId = findChildByName(leftHandProxy, 'TargetProxy')?.id;
        let rightHandTargetProxyId = findChildByName(rightHandProxy, 'TargetProxy')?.id;

        if (!headTargetId || !leftHandTargetProxyId || !rightHandTargetProxyId) {
            const missing = [];
            if (!headTargetId) missing.push("Head TargetProxy");
            if (!leftHandTargetProxyId) missing.push("Left TargetProxy");
            if (!rightHandTargetProxyId) missing.push("Right TargetProxy");
            return res.send(`Error: Missing target slots: ${missing.join(", ")}. / エラー: ターゲットスロットが見つかりません: ${missing.join(", ")}`);
        }

        const [headTargetRes, leftHandTargetProxyRes, rightHandTargetProxyRes] = await Promise.all([
            resoniteClient.getSlot(headTargetId, 0, true),
            resoniteClient.getSlot(leftHandTargetProxyId, 0, true),
            resoniteClient.getSlot(rightHandTargetProxyId, 0, true)
        ]);

        if (!headTargetRes.success || !leftHandTargetProxyRes.success || !rightHandTargetProxyRes.success) {
            return res.send("Error: Failed to get slot details for targets. / エラー: ターゲットの詳細取得に失敗しました。");
        }

        const headTarget = headTargetRes.data;
        const leftHandTargetProxy = leftHandTargetProxyRes.data;
        const rightHandTargetProxy = rightHandTargetProxyRes.data;

        // Find DV slot in FaceTrack
        const dvSlot = findChildByName(faceTrackDetail.data, 'DV');
        if (!dvSlot) {
            return res.send("Error: DV slot not found in FaceTrack. / エラー: FaceTrack 内に DV スロットが見つかりません。");
        }

        const dvDetail = await resoniteClient.getSlot(dvSlot.id, 0, true);
        if (!dvDetail.success || !dvDetail.data.components) {
            return res.send("Error: DV components not found. / エラー: DV コンポーネントが見つかりません。");
        }

        // DV variable mapping logic from server-example.js
        const variableMapping = {
            'HeadProxyTargetSlot': { slotId: headTarget.id, fieldId: null },
            'HeadProxyPosition': { slotId: null, fieldId: headTarget.position?.id },
            'HeadProxyTargetPosition': { slotId: null, fieldId: headTarget.position?.id },
            'HeadProxyTargetRotation': { slotId: null, fieldId: headTarget.rotation?.id },
            'LeftHandProxySlot': { slotId: leftHandTargetProxy.id, fieldId: null },
            'LeftHandProxyTargetPosition': { slotId: null, fieldId: leftHandTargetProxy.position?.id },
            'LeftHandProxyTargetRotation': { slotId: null, fieldId: leftHandTargetProxy.rotation?.id },
            'RightHandProxySlot': { slotId: rightHandTargetProxy.id, fieldId: null },
            'RightHandProxyTargetPosition': { slotId: null, fieldId: rightHandTargetProxy.position?.id },
            'RightHandProxyTargetRotation': { slotId: null, fieldId: rightHandTargetProxy.rotation?.id }
        };

        console.log(`[FaceTrack] Head Target properties - Position ID: ${headTarget.position?.id || 'null'}, Rotation ID: ${headTarget.rotation?.id || 'null'}`);

        console.log('[FaceTrack] Updating DV variables...');
        const dvVarsFound = [];
        for (const component of dvDetail.data.components) {
            if (!component.members?.VariableName) continue;
            const varName = component.members.VariableName.value;
            dvVarsFound.push(varName);
            const mapping = variableMapping[varName];

            if (mapping) {
                const targetId = mapping.slotId || mapping.fieldId;
                if (targetId && component.members.Reference) {
                    try {
                        const updateResult = await resoniteClient.updateComponent(component.id, {
                            Reference: { $type: 'reference', targetId: targetId }
                        });
                        console.log(`[FaceTrack] Updated ${varName} -> ${targetId} (Success: ${updateResult.success})`);
                    } catch (err) {
                        console.error(`[FaceTrack] Error updating ${varName}:`, err.message);
                    }
                } else {
                    console.log(`[FaceTrack] SKIPPED ${varName}: targetId=${targetId}, hasReference=${!!component.members.Reference}`);
                }
            }
        }
        console.log(`[FaceTrack] All VariableNames found in DV slot: ${dvVarsFound.join(', ')}`);

        // Mouth setup
        console.log('[FaceTrack] Starting mouth setup...');
        const mouthSetupResult = await setupMouthShapeKeys(resoniteClient, avatarSlot, faceTrackDetail.data);
        console.log(`[FaceTrack] Mouth setup complete: ${mouthSetupResult}`);

        // ARKit setup (includes EyeManager setup - auto-blink disable + EyeClosed to EyeLinearDriver)
        let arkitSummary = '';
        let eyeManagerResult = '';
        if (runArkit) {
            console.log('[FaceTrack] Starting ARKit setup...');
            const arkitResult = await arkitSetup.runArkitSetup({
                username,
                userSlotId: userSlot?.id,
                port,
                limit: arkitLimit,
                debugSelf: arkitDebugSelf,
                noType: arkitNoType,
                batch: arkitBatch
            });
            eyeManagerResult = arkitResult.eyeManagerResult || '';
            arkitSummary = ` ARKit: created ${arkitResult.createdCount}, updated ${arkitResult.updatedCount}, found ${arkitResult.foundCount}.`;
            console.log(`[FaceTrack] ARKit setup complete: ${eyeManagerResult}${arkitSummary.trim()}`);
        }

        const successMessage = `Success: Setup complete for "${username}".${mouthSetupResult}${eyeManagerResult}${arkitSummary} / 成功: "${username}" のセットアップが完了しました。${mouthSetupResult}${eyeManagerResult}${arkitSummary}`;
        console.log(`[FaceTrack] Sending success response...`);
        res.send(successMessage);
        console.log('[FaceTrack] Response sent!');
    } catch (error) {
        console.error('[FaceTrack] Setup error:', error);
        const errorMessage = isConnectionRefusedError(error)
            ? RESONITE_LINK_REFUSED_MESSAGE
            : `Error: ${error.message} / エラー: ${error.message}`;
        console.log(`[FaceTrack] Sending error response: ${errorMessage}`);
        res.send(errorMessage);
    } finally {
        isSettingUp = false;
        console.log('[FaceTrack] Setup finished (isSettingUp = false)');
    }
});

app.get('/resonite-disconnect', (req, res) => {
    if (resoniteClient) {
        resoniteClient.disconnect();
        resoniteClient = null;
    }
    res.send("Success: Disconnected from ResoniteLink. / 成功: ResoniteLink から切断しました。");
});

app.listen(WEB_PORT, () => {
    console.log(`[Server] ResoniteLink Bridge running at http://localhost:${WEB_PORT}`);
});
