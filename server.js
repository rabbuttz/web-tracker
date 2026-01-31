import express from 'express';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

const WEB_PORT = 3000;
const DEFAULT_RESONITE_PORT = 10534;

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
            data: { id: componentId, members }
        });
    }

    async getComponent(componentId) {
        return this.sendMessage({
            $type: 'getComponent',
            messageId: uuidv4(),
            componentId
        });
    }
}

let resoniteClient = null;
let currentResonitePort = null;
let isSettingUp = false;

const app = express();
app.use(express.json());

// Helper functions (extracted from ResoniteLink logic)
function getSlotName(slot) {
    if (!slot) return '';
    return typeof slot.name === 'string' ? slot.name : (slot.name?.value || '');
}

function findChildByName(slot, name) {
    if (!slot.children) return null;
    return slot.children.find(child => getSlotName(child) === name);
}

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

    // Phase 0: Save shape key field IDs from DirectVisemeDriver BEFORE redirecting
    console.log('[Mouth Setup] Phase 0: Saving shape key field IDs from DirectVisemeDriver...');
    const savedShapeKeyFieldIds = {};
    for (const [visemeField, mouthVarName] of Object.entries(visemeToMouthMapping)) {
        const visemeMember = visemeMembers[visemeField];
        if (visemeMember?.targetId) {
            savedShapeKeyFieldIds[visemeField] = visemeMember.targetId;
            console.log(`[Mouth Setup] Saved ${visemeField} -> ${visemeMember.targetId}`);
        } else {
            console.log(`[Mouth Setup] WARNING: No targetId found for ${visemeField}`);
        }
    }
    console.log(`[Mouth Setup] Saved shape keys: ${JSON.stringify(savedShapeKeyFieldIds)}`);

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
    const port = parseInt(req.query.port) || DEFAULT_RESONITE_PORT;

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

        // Recursive search function
        const findUserSlot = (slot, depth = 0) => {
            const name = getSlotName(slot);
            const indent = '  '.repeat(depth);
            console.log(`[FaceTrack] ${indent}Checking: "${name}"`);

            if (name.includes(username) && name.startsWith('User')) {
                console.log(`[FaceTrack] ${indent}-> MATCH!`);
                return slot;
            }

            if (slot.children) {
                for (const child of slot.children) {
                    const found = findUserSlot(child, depth + 1);
                    if (found) return found;
                }
            }
            return null;
        };

        let userSlot = findUserSlot(rootResponse.data);

        // If not found in depth=1, try deeper search (depth=3)
        if (!userSlot) {
            console.log('[FaceTrack] User not found in depth=1, searching deeper (depth=3)...');
            rootResponse = await resoniteClient.getSlot('Root', 3, false);
            if (rootResponse.success) {
                userSlot = findUserSlot(rootResponse.data);
            }
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

        console.log('[FaceTrack] Starting mouth setup...');
        const mouthSetupResult = await setupMouthShapeKeys(resoniteClient, avatarSlot, faceTrackDetail.data);
        console.log(`[FaceTrack] Mouth setup complete: ${mouthSetupResult}`);

        const successMessage = `Success: Setup complete for "${username}".${mouthSetupResult} / 成功: "${username}" のセットアップが完了しました。${mouthSetupResult}`;
        console.log(`[FaceTrack] Sending success response...`);
        res.send(successMessage);
        console.log('[FaceTrack] Response sent!');
    } catch (error) {
        console.error('[FaceTrack] Setup error:', error);
        const errorMessage = `Error: ${error.message} / エラー: ${error.message}`;
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
