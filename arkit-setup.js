const ARKIT_BLENDSHAPES = [
    'browDownLeft',
    'browDownRight',
    'browInnerUp',
    'browOuterUpLeft',
    'browOuterUpRight',
    'cheekPuff',
    'cheekSquintLeft',
    'cheekSquintRight',
    'eyeBlinkLeft',
    'eyeBlinkRight',
    'eyeLookDownLeft',
    'eyeLookDownRight',
    'eyeLookInLeft',
    'eyeLookInRight',
    'eyeLookOutLeft',
    'eyeLookOutRight',
    'eyeLookUpLeft',
    'eyeLookUpRight',
    'eyeSquintLeft',
    'eyeSquintRight',
    'eyeWideLeft',
    'eyeWideRight',
    'jawForward',
    'jawLeft',
    'jawRight',
    'jawOpen',
    'mouthClose',
    'mouthFunnel',
    'mouthPucker',
    'mouthLeft',
    'mouthRight',
    'mouthSmileLeft',
    'mouthSmileRight',
    'mouthFrownLeft',
    'mouthFrownRight',
    'mouthDimpleLeft',
    'mouthDimpleRight',
    'mouthStretchLeft',
    'mouthStretchRight',
    'mouthRollLower',
    'mouthRollUpper',
    'mouthShrugLower',
    'mouthShrugUpper',
    'mouthPressLeft',
    'mouthPressRight',
    'mouthLowerDownLeft',
    'mouthLowerDownRight',
    'mouthUpperUpLeft',
    'mouthUpperUpRight',
    'noseSneerLeft',
    'noseSneerRight',
    'tongueOut'
];

const SMR_TYPE = '[FrooxEngine]FrooxEngine.SkinnedMeshRenderer';

function buildOscPath(basePath, shapeName) {
    const defaultPrefix = '/avatar/parameters/FT/v2';
    const fallback = `${defaultPrefix}/${shapeName}`;
    if (!basePath || typeof basePath !== 'string') return fallback;

    let trimmed = basePath.trim();
    if (!trimmed || trimmed === 'FacialName') return fallback;

    // Handle trailing slash
    if (trimmed.endsWith('/')) {
        return trimmed + shapeName;
    }

    // Check if it ends with any of the known ARKit blendshape names (case-insensitive)
    const lowerTrimmed = trimmed.toLowerCase();
    for (const shape of ARKIT_BLENDSHAPES) {
        const lowerShape = shape.toLowerCase();

        // Match /shapeName or just shapeName
        if (lowerTrimmed.endsWith('/' + lowerShape)) {
            return trimmed.substring(0, trimmed.length - shape.length) + shapeName;
        }
        if (lowerTrimmed === lowerShape) {
            // It was just the shape name, likely lost prefix. Use default.
            return `${defaultPrefix}/${shapeName}`;
        }
    }

    // If it contains a slash, assume it is a prefix and append shape
    if (trimmed.includes('/')) {
        return trimmed + '/' + shapeName;
    }

    // Otherwise, it might be a custom string or a broken shape name. Use default.
    return fallback;
}

function getMemberKey(members, keyLower, fallback) {
    if (!members) return fallback;
    const found = Object.keys(members).find(key => key.toLowerCase() === keyLower);
    return found || fallback;
}

function getMemberValue(member) {
    if (!member || typeof member !== 'object') return null;
    if (member.value !== undefined) return member.value;
    if (member.Value !== undefined) return member.Value;
    return null;
}

function pickMemberKey(members, candidates, fallback = null) {
    if (!members) return fallback;
    const keyMap = new Map();
    for (const key of Object.keys(members)) {
        keyMap.set(key.toLowerCase(), key);
    }
    for (const candidate of candidates) {
        const key = keyMap.get(candidate.toLowerCase());
        if (key) return key;
    }
    return fallback;
}

function isReferenceMember(member) {
    if (!member || typeof member !== 'object') return false;
    if (member.$type === 'reference') return true;
    return member.targetId !== undefined || member.TargetID !== undefined;
}

function formatMemberSummary(members) {
    if (!members) return '';
    return Object.entries(members).map(([key, member]) => {
        if (!member || typeof member !== 'object') return `${key}:${typeof member}`;
        const type = member.$type || 'unknown';
        const targetType = member.targetType ? `(${member.targetType})` : '';
        const hasId = member.id ? ':id' : '';
        const hasTarget = member.targetId || member.TargetID ? ':targetId' : '';
        return `${key}:${type}${targetType}${hasId}${hasTarget}`;
    }).join(', ');
}

function resolveSmoothDriveMember(members) {
    if (!members) return null;

    const valueKey = getMemberKey(members, 'value', null);
    if (valueKey && isReferenceMember(members[valueKey])) {
        return { key: valueKey, member: members[valueKey] };
    }

    for (const [key, member] of Object.entries(members)) {
        if (!isReferenceMember(member)) continue;
        if (member.targetType && member.targetType.includes('IField<float>')) {
            return { key, member };
        }
    }

    for (const candidate of ['Target', 'Input', 'Drive', 'Output']) {
        const key = pickMemberKey(members, [candidate], null);
        if (key && isReferenceMember(members[key])) {
            return { key, member: members[key] };
        }
    }

    const fallbackKey = findReferenceMemberKey(members);
    if (fallbackKey && isReferenceMember(members[fallbackKey])) {
        return { key: fallbackKey, member: members[fallbackKey] };
    }

    return null;
}

function cloneMembersForAdd(members, omitKeysLower) {
    if (!members) return null;
    const result = {};
    for (const [key, value] of Object.entries(members)) {
        if (omitKeysLower && omitKeysLower.has(key.toLowerCase())) {
            continue;
        }
        result[key] = cloneMemberWithoutIds(value);
    }
    return result;
}

function cloneMemberWithoutIds(value) {
    if (Array.isArray(value)) {
        return value.map(item => cloneMemberWithoutIds(item));
    }
    if (value && typeof value === 'object') {
        const cloned = {};
        for (const [key, entry] of Object.entries(value)) {
            if (key === 'id') continue;
            cloned[key] = cloneMemberWithoutIds(entry);
        }
        return cloned;
    }
    return value;
}

async function pickSkinnedMeshRenderer(client, avatarSlot) {
    const avatarDetail = await client.getSlot(avatarSlot.id, 5, true);
    if (!avatarDetail.success) {
        throw new Error('Failed to get avatar slot details for SkinnedMeshRenderer search');
    }

    const candidates = [];
    const walk = (slot) => {
        if (!slot) return;
        if (slot.components) {
            for (const component of slot.components) {
                const type = component.type || component.componentType || '';
                if (type.includes('SkinnedMeshRenderer')) {
                    candidates.push({ slot, component });
                }
            }
        }
        if (slot.children) {
            for (const child of slot.children) {
                walk(child);
            }
        }
    };

    walk(avatarDetail.data);
    if (!candidates.length) {
        return null;
    }

    let best = null;
    for (const candidate of candidates) {
        const detail = await client.getComponent(candidate.component.id);
        if (!detail.success) continue;
        const blendShapes = detail.data.members?.BlendShapeWeights;
        const count = blendShapes?.elements?.length || blendShapes?.value?.length || 0;
        if (!best || count > best.count) {
            best = { ...candidate, detail, count };
        }
    }

    return best || { ...candidates[0], detail: null, count: 0 };
}

function findReferenceMemberKey(members, targetTypeIncludes = null) {
    if (!members) return null;
    let fallback = null;
    for (const [key, member] of Object.entries(members)) {
        if (!member || typeof member !== 'object') continue;
        if (member.$type !== 'reference') continue;
        if (targetTypeIncludes && member.targetType && member.targetType.includes(targetTypeIncludes)) {
            return key;
        }
        if (!fallback) fallback = key;
    }
    return fallback;
}

function buildBlendShapeCandidates(shapeNames) {
    const candidates = [];
    const aliasMap = {};

    for (const name of shapeNames) {
        const variants = new Set([name]);
        if (name && name.length > 0) {
            variants.add(name[0].toUpperCase() + name.slice(1));
        }
        for (const variant of variants) {
            if (!aliasMap[variant]) {
                aliasMap[variant] = name;
                candidates.push(variant);
            }
        }
    }

    return { candidates, aliasMap };
}

async function resolveBlendShapeFields(client, driverSlotId, smrId, shapeNames, nameAliasMap = null, driverId = null) {
    const resolved = {};
    let finalDriverId = driverId || `BlendShapeFinder_${Date.now()}`;
    const elements = shapeNames.map(name => ({
        $type: 'syncObject',
        members: {
            BlendShapeName: { $type: 'string', value: name },
            Value: { $type: 'float', value: 0.0 }
        }
    }));

    let hasDriver = false;
    if (driverId) {
        const existing = await client.getComponent(driverId);
        if (existing.success) {
            await client.removeComponent(driverId);
            await new Promise(resolve => setTimeout(resolve, 300));
            hasDriver = false;
        }
    }

    let added = false;
    if (!hasDriver) {
        const addResult = await client.addComponent(
            driverSlotId,
            '[FrooxEngine]FrooxEngine.DynamicBlendShapeDriver',
            {
                Renderer: { $type: 'reference', targetId: smrId, targetType: SMR_TYPE },
                BlendShapes: { $type: 'list', elements }
            },
            finalDriverId
        );
        if (!addResult.success) {
            if (addResult.errorInfo && addResult.errorInfo.includes('ID')) {
                finalDriverId = `${finalDriverId}_${Date.now()}`;
                const retry = await client.addComponent(
                    driverSlotId,
                    '[FrooxEngine]FrooxEngine.DynamicBlendShapeDriver',
                    {
                        Renderer: { $type: 'reference', targetId: smrId, targetType: SMR_TYPE },
                        BlendShapes: { $type: 'list', elements }
                    },
                    finalDriverId
                );
                if (!retry.success) {
                    throw new Error(`Failed to add DynamicBlendShapeDriver: ${retry.errorInfo || 'unknown error'}`);
                }
                added = true;
            } else {
                throw new Error(`Failed to add DynamicBlendShapeDriver: ${addResult.errorInfo || 'unknown error'}`);
            }
        } else {
            added = true;
        }
    }

    if (!added) {
        const updateResult = await client.updateComponent(finalDriverId, {
            Renderer: { $type: 'reference', targetId: smrId, targetType: SMR_TYPE },
            BlendShapes: { $type: 'list', elements }
        });
        if (!updateResult.success) {
            throw new Error(`Failed to update DynamicBlendShapeDriver: ${updateResult.errorInfo || 'unknown error'}`);
        }
    }

    const parseDriver = (driverDetail) => {
        const localResolved = {};
        const blendShapes = driverDetail.data.members?.BlendShapes;
        const elementsOut = blendShapes?.elements || blendShapes?.Elements || [];

        elementsOut.forEach((element, index) => {
            const members = element?.members || element?.Members || {};
            const nameMember = members.BlendShapeName || null;
            const resolvedName = nameMember?.value || nameMember?.Value || null;
            const valueMember = members.Value || members.value || null;
            const valueFieldId = valueMember?.id || null;
            const sourceName = resolvedName || shapeNames[index] || null;
            const targetName = nameAliasMap?.[sourceName] || sourceName;
            if (targetName && valueFieldId) {
                localResolved[targetName] = valueFieldId;
            }
        });

        return { localResolved, elementsOut };
    };

    let lastCount = -1;
    let lastResolved = {};
    for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const driverDetail = await client.getComponent(finalDriverId);
        if (!driverDetail.success) {
            throw new Error('Failed to get DynamicBlendShapeDriver details');
        }

        const { localResolved } = parseDriver(driverDetail);
        const resolvedCount = Object.keys(localResolved).length;

        lastResolved = localResolved;
        if (resolvedCount === lastCount) {
            break;
        }
        lastCount = resolvedCount;
    }

    console.log(`[ARKit Setup] Resolved blendshapes: ${Object.keys(lastResolved).length}/${shapeNames.length}`);

    return { driverId: finalDriverId, resolved: lastResolved };
}

export function createArkitSetup({
    ResoniteLinkClient,
    defaultResonitePort,
    getSlotName,
    findChildByName,
    getResoniteClient,
    setResoniteClient,
    getCurrentResonitePort,
    setCurrentResonitePort,
    getIsSettingUp,
    setIsSettingUp
}) {
    const ensureConnected = async (port) => {
        const targetPort = port || defaultResonitePort;
        let client = getResoniteClient();
        const currentPort = getCurrentResonitePort();
        if (!client || !client.isConnected || currentPort !== targetPort) {
            if (client) client.disconnect();
            const wsUrl = `ws://localhost:${targetPort}`;
            console.log(`[ARKit Setup] Connecting to ResoniteLink at ${wsUrl}...`);
            client = new ResoniteLinkClient(wsUrl);
            await client.connect();
            setResoniteClient(client);
            setCurrentResonitePort(targetPort);
            console.log('[ARKit Setup] Connection established');
        }
        return client;
    };

    const runArkitSetup = async ({
        username,
        port = defaultResonitePort,
        limit = ARKIT_BLENDSHAPES.length,
        debugSelf = false,
        noType = false,
        batch = 8
    }) => {
        if (!username) {
            throw new Error('Username parameter required');
        }

        const shapeLimit = Math.max(1, Math.min(parseInt(limit, 10), ARKIT_BLENDSHAPES.length));
        const shapeList = ARKIT_BLENDSHAPES.slice(0, shapeLimit);
        const batchSize = Math.max(1, Math.min(parseInt(batch, 10), shapeList.length));

        console.log(`[ARKit Setup] Starting setup for user: ${username} (port: ${port})`);

        const client = await ensureConnected(port);

        let rootResponse = await client.getSlot('Root', 1, false);
        if (!rootResponse.success) throw new Error('Failed to get root slot');

        const findUserSlot = (slot) => {
            if (!slot) return null;
            const slotName = getSlotName(slot);
            if (slotName && slotName.includes(username)) return slot;
            if (slot.children) {
                for (const child of slot.children) {
                    const result = findUserSlot(child);
                    if (result) return result;
                }
            }
            return null;
        };

        let userSlot = findUserSlot(rootResponse.data);
        if (!userSlot) {
            rootResponse = await client.getSlot('Root', 3, false);
            if (rootResponse.success) {
                userSlot = findUserSlot(rootResponse.data);
            }
        }

        if (!userSlot) {
            throw new Error(`User "${username}" not found.`);
        }

        console.log(`[ARKit Setup] Found user slot: ${getSlotName(userSlot)} (${userSlot.id})`);
        const userDeepResponse = await client.getSlot(userSlot.id, 10, false);
        if (!userDeepResponse.success) throw new Error('Failed to get user slot children');

        const findFaceTrackSlot = (slot) => {
            const name = getSlotName(slot);
            if (name.includes('FaceTrack_ver')) return slot;
            if (slot.children) {
                for (const child of slot.children) {
                    const found = findFaceTrackSlot(child);
                    if (found) return found;
                }
            }
            return null;
        };

        const faceTrackSlot = findFaceTrackSlot(userDeepResponse.data);
        if (!faceTrackSlot) {
            throw new Error(`FaceTrack_ver slot not found under user "${username}".`);
        }

        const faceTrackDetail = await client.getSlot(faceTrackSlot.id, 2, true);
        if (!faceTrackDetail.success) throw new Error('Failed to get FaceTrack slot details');

        const faceSlot = findChildByName(faceTrackDetail.data, 'Face');
        if (!faceSlot) {
            throw new Error('Face slot not found under FaceTrack_ver.');
        }

        const faceDetail = await client.getSlot(faceSlot.id, 2, true);
        if (!faceDetail.success) throw new Error('Failed to get Face slot details');

        const templateComponents = faceDetail.data.components || [];
        const oscTemplate = templateComponents.find(comp => (comp.type || comp.componentType || '').includes('OSC_Field'));
        const smoothTemplate = templateComponents.find(comp => (comp.type || comp.componentType || '').includes('SmoothValue'));
        if (!oscTemplate || !smoothTemplate) {
            throw new Error('Face slot missing OSC_Field or SmoothValue template components');
        }

        const oscType = oscTemplate.type || oscTemplate.componentType;
        const smoothType = smoothTemplate.type || smoothTemplate.componentType;
        const oscPathKey = getMemberKey(oscTemplate.members, 'path', 'Path');
        const oscFieldKey = getMemberKey(oscTemplate.members, 'field', 'Field');
        const smoothValueKey = getMemberKey(smoothTemplate.members, 'value', 'Value');
        const smoothTargetKey = getMemberKey(smoothTemplate.members, 'targetvalue', 'TargetValue');
        const smoothWriteBackKey = getMemberKey(smoothTemplate.members, 'writeback', 'WriteBack');

        console.log(`[ARKit Setup] SmoothValue template target key: ${smoothTargetKey}`);

        const basePathMember = oscTemplate?.members?.[oscPathKey] || null;
        const basePath = getMemberValue(basePathMember);

        const parentId = faceTrackDetail.data.parent?.targetId;
        if (!parentId) {
            throw new Error('FaceTrack parent (avatar) not found.');
        }

        const avatarResponse = await client.getSlot(parentId, 4, true);
        if (!avatarResponse.success) throw new Error('Failed to get avatar slot');

        const avatarSlot = avatarResponse.data;
        const smrPick = await pickSkinnedMeshRenderer(client, avatarSlot);
        if (!smrPick) throw new Error('SkinnedMeshRenderer not found in avatar');
        const smr = smrPick.component;

        const resolvedMap = {};
        const batches = [];
        for (let i = 0; i < shapeList.length; i += batchSize) {
            batches.push(shapeList.slice(i, i + batchSize));
        }

        for (let i = 0; i < batches.length; i++) {
            const batchSet = batches[i];
            const { candidates, aliasMap } = buildBlendShapeCandidates(batchSet);
            const driverId = `ARKIT_DBD_${Date.now()}_${i}`;
            const resolveResult = await resolveBlendShapeFields(client, faceTrackSlot.id, smr.id, candidates, aliasMap, driverId);
            Object.assign(resolvedMap, resolveResult.resolved);
        }

        const faceComponents = faceDetail.data.components || [];
        const oscComponents = faceComponents.filter(comp => (comp.type || comp.componentType || '').includes('OSC_Field'));
        const smoothComponents = faceComponents.filter(comp => (comp.type || comp.componentType || '').includes('SmoothValue'));
        const oscByPath = new Map();
        const smoothByTargetValue = new Map();

        for (const oscComponent of oscComponents) {
            const pathKey = getMemberKey(oscComponent.members, 'path', oscPathKey);
            const pathMember = pathKey ? oscComponent.members?.[pathKey] : null;
            const pathValue = getMemberValue(pathMember);
            if (pathValue) {
                oscByPath.set(pathValue, oscComponent);
            }
        }

        for (const smoothComponent of smoothComponents) {
            const targetKey = getMemberKey(smoothComponent.members, 'targetvalue', smoothTargetKey);
            const targetMember = targetKey ? smoothComponent.members?.[targetKey] : null;
            const targetId = targetMember?.id || null;
            if (targetId) {
                smoothByTargetValue.set(targetId, smoothComponent);
            }
        }

        const created = [];
        const updated = [];
        const missing = [];
        const idPrefix = `ARKIT_${Date.now()}`;

        for (const shapeName of shapeList) {
            const fieldId = resolvedMap[shapeName];
            if (!fieldId) {
                missing.push(shapeName);
                continue;
            }

            const oscPath = buildOscPath(basePath, shapeName);
            const existingOsc = oscByPath.get(oscPath) || null;
            let oscComponentId = existingOsc?.id || null;
            let smoothComponentId = null;
            let smoothTargetValueId = null;
            let smoothValueMemberId = null;
            let smoothDriveKey = null;
            let smoothDriveTargetType = null;
            let smoothTargetKeyLocal = smoothTargetKey;
            let smoothWriteBackKeyLocal = smoothWriteBackKey;

            if (existingOsc) {
                const fieldKey = getMemberKey(existingOsc.members, 'field', oscFieldKey);
                const fieldMember = fieldKey ? existingOsc.members?.[fieldKey] : null;
                const fieldTargetId = fieldMember?.targetId || fieldMember?.TargetID || null;
                const existingSmooth = fieldTargetId ? smoothByTargetValue.get(fieldTargetId) : null;
                if (existingSmooth) {
                    smoothComponentId = existingSmooth.id;
                }
            }

            let smoothDetail = null;
            if (!smoothComponentId) {
                const smoothId = `${idPrefix}_Smooth_${shapeName}`;
                const smoothMembers = cloneMembersForAdd(
                    smoothTemplate.members,
                    new Set([smoothValueKey.toLowerCase()])
                );
                if (smoothWriteBackKey) {
                    smoothMembers[smoothWriteBackKey] = { $type: 'bool', value: true };
                }
                const smoothAdd = await client.addComponent(faceSlot.id, smoothType, smoothMembers, smoothId);
                if (!smoothAdd.success) {
                    throw new Error(`Failed to add SmoothValue for ${shapeName}: ${smoothAdd.errorInfo || 'unknown error'}`);
                }

                smoothDetail = await client.getComponent(smoothId);
                if (!smoothDetail.success) {
                    throw new Error(`Failed to get SmoothValue details for ${shapeName}`);
                }
                smoothComponentId = smoothId;
            } else {
                smoothDetail = await client.getComponent(smoothComponentId);
                if (!smoothDetail.success) {
                    console.warn(`[ARKit Setup] Failed to get SmoothValue details for ${shapeName} (${smoothComponentId})`);
                    missing.push(shapeName);
                    continue;
                }
            }

            const smoothMembers = smoothDetail.data.members || {};
            smoothTargetKeyLocal = getMemberKey(smoothMembers, 'targetvalue', smoothTargetKey);
            smoothWriteBackKeyLocal = getMemberKey(smoothMembers, 'writeback', smoothWriteBackKey);
            smoothTargetValueId = smoothTargetKeyLocal ? smoothMembers?.[smoothTargetKeyLocal]?.id || null : null;
            if (smoothWriteBackKey && !smoothWriteBackKeyLocal) {
                console.warn(`[ARKit Setup] SmoothValue writeback key not found for ${shapeName} (${smoothComponentId}). Members: ${formatMemberSummary(smoothMembers)}`);
            }
            const driveInfo = resolveSmoothDriveMember(smoothMembers);
            if (!driveInfo) {
                console.warn(`[ARKit Setup] SmoothValue drive member not found for ${shapeName} (${smoothComponentId}). Members: ${formatMemberSummary(smoothMembers)}`);
                missing.push(shapeName);
                continue;
            }
            smoothDriveKey = driveInfo.key;
            smoothValueMemberId = driveInfo.member?.id || null;
            smoothDriveTargetType = driveInfo.member?.targetType || null;

            if (!smoothTargetValueId) {
                console.warn(`[ARKit Setup] SmoothValue target field missing for ${shapeName} (${smoothComponentId}). Members: ${formatMemberSummary(smoothMembers)}`);
                missing.push(shapeName);
                continue;
            }

            const valueKey = getMemberKey(smoothMembers, 'value', null);
            if (valueKey && !isReferenceMember(smoothMembers[valueKey]) && smoothDriveKey !== valueKey) {
                console.warn(`[ARKit Setup] SmoothValue Value is not a reference for ${shapeName} (${smoothComponentId}). Using "${smoothDriveKey}" instead.`);
            }

            if (!oscComponentId) {
                const oscId = `${idPrefix}_OSC_${shapeName}`;
                const oscMembers = cloneMembersForAdd(oscTemplate.members, new Set([oscPathKey.toLowerCase(), oscFieldKey.toLowerCase()]));
                const oscAdd = await client.addComponent(faceSlot.id, oscType, oscMembers, oscId);
                if (!oscAdd.success) {
                    throw new Error(`Failed to add OSC_Field for ${shapeName}: ${oscAdd.errorInfo || 'unknown error'}`);
                }
                oscComponentId = oscId;
            }

            const oscPathKeyLocal = existingOsc ? getMemberKey(existingOsc.members, 'path', oscPathKey) : oscPathKey;
            const oscFieldKeyLocal = existingOsc ? getMemberKey(existingOsc.members, 'field', oscFieldKey) : oscFieldKey;
            const oscUpdate = await client.updateComponent(oscComponentId, {
                [oscPathKeyLocal]: { $type: 'string', value: oscPath },
                [oscFieldKeyLocal]: { $type: 'reference', targetId: smoothTargetValueId }
            });

            const smoothTargetForUpdate = debugSelf ? fieldId : fieldId; // Both already point to SMR field if resolved correctly

            // LOGIC FIX: In the current setup:
            // resolvedMap (fieldId) stores IDs from the SkinnedMeshRenderer (SMR).
            // DynamicBlendShapeDriver (DBD)'s values are transient and should NOT be the source for SmoothValue
            // unless we explicitly want to bridge through DBD (which is redundant).
            // SmoothValue.Value should point to the SMR field.

            let smoothWriteUpdate = { success: true };
            if (smoothWriteBackKeyLocal) {
                smoothWriteUpdate = await client.updateComponent(smoothComponentId, {
                    [smoothWriteBackKeyLocal]: { $type: 'bool', value: true }
                });
            }
            const smoothDrivePayload = noType ? {
                targetId: fieldId, // ALWAYS point to SMR field
                ...(smoothValueMemberId ? { id: smoothValueMemberId } : {})
            } : {
                $type: 'reference',
                targetId: fieldId, // ALWAYS point to SMR field
                ...(smoothValueMemberId ? { id: smoothValueMemberId } : {}),
                ...(smoothDriveTargetType ? { targetType: smoothDriveTargetType } : {})
            };
            const smoothUpdate = await client.updateComponent(smoothComponentId, {
                [smoothDriveKey]: smoothDrivePayload
            });
            let verified = false;
            const issues = [];
            try {
                if (!oscUpdate.success) {
                    console.warn(`[ARKit Setup] OSC_Field update failed for ${shapeName} (${oscComponentId}): ${oscUpdate.errorInfo || 'unknown error'}`);
                    issues.push(`OSC_Field update failed: ${oscUpdate.errorInfo || 'unknown error'}`);
                }
                if (!smoothWriteUpdate.success) {
                    console.warn(`[ARKit Setup] SmoothValue writeback update failed for ${shapeName} (${smoothComponentId}): ${smoothWriteUpdate.errorInfo || 'unknown error'}`);
                    issues.push(`SmoothValue writeback update failed: ${smoothWriteUpdate.errorInfo || 'unknown error'}`);
                }
                if (!smoothUpdate.success) {
                    console.warn(`[ARKit Setup] SmoothValue value update failed for ${shapeName} (${smoothComponentId}): ${smoothUpdate.errorInfo || 'unknown error'}`);
                    issues.push(`SmoothValue value update failed: ${smoothUpdate.errorInfo || 'unknown error'}`);
                }

                await new Promise(resolve => setTimeout(resolve, 200));

                const [oscVerify, smoothVerify] = await Promise.all([
                    client.getComponent(oscComponentId),
                    client.getComponent(smoothComponentId)
                ]);

                if (oscVerify.success && smoothVerify.success) {
                    const oscMembers = oscVerify.data.members || {};
                    const smoothMembersVerify = smoothVerify.data.members || {};
                    const verifyPath = getMemberValue(oscMembers[oscPathKeyLocal]);
                    const verifyField = oscMembers[oscFieldKeyLocal];
                    const verifyFieldTargetId = verifyField?.targetId || verifyField?.TargetID || null;
                    const verifyTargetValue = smoothMembersVerify[smoothTargetKeyLocal];
                    const verifyTargetValueId = verifyTargetValue?.id || null;
                    const verifyValue = smoothMembersVerify[smoothDriveKey];
                    const verifyValueTargetId = verifyValue?.targetId || verifyValue?.TargetID || null;

                    if (verifyPath !== oscPath) {
                        issues.push('Path mismatch');
                    }
                    if (verifyFieldTargetId !== verifyTargetValueId) {
                        issues.push('OSC Field not linked to SmoothValue.TargetValue');
                    }
                    if (verifyValueTargetId !== fieldId) {
                        issues.push('SmoothValue not linked to BlendShape field');
                    }
                    verified = issues.length === 0;
                } else {
                    issues.push('Verification getComponent failed');
                }
            } catch (err) {
                issues.push(`Verification error: ${err.message}`);
            }

            const record = {
                shapeName,
                oscPath,
                fieldId,
                oscComponentId,
                smoothComponentId,
                verified,
                issues
            };
            if (existingOsc) {
                updated.push(record);
            } else {
                created.push(record);
            }
        }

        return {
            success: true,
            createdCount: created.length,
            updatedCount: updated.length,
            missingCount: missing.length,
            created,
            updated,
            missing
        };
    };

    const handleFindBlendshape = async (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const username = req.query.username;
        const port = parseInt(req.query.port, 10) || defaultResonitePort;
        const shapeName = req.query.shape || 'JawLeft';

        if (!username) {
            return res.status(400).send('Error: Username parameter required / エラー: usernameパラメータが必須です。');
        }

        if (getIsSettingUp()) {
            return res.send('Error: Setup is already in progress. / エラー: セットアップが既に進行中です。');
        }

        setIsSettingUp(true);
        console.log(`[FindBlendShape] Starting search for "${shapeName}" (user: ${username}, port: ${port})`);

        let driverId = null;

        try {
            const client = await ensureConnected(port);

            let rootResponse = await client.getSlot('Root', 1, false);
            if (!rootResponse.success) throw new Error('Failed to get root slot');

            const findUserSlot = (slot) => {
                if (!slot) return null;
                const slotName = getSlotName(slot);
                if (slotName && slotName.includes(username)) return slot;
                if (slot.children) {
                    for (const child of slot.children) {
                        const result = findUserSlot(child);
                        if (result) return result;
                    }
                }
                return null;
            };

            let userSlot = findUserSlot(rootResponse.data);
            if (!userSlot) {
                rootResponse = await client.getSlot('Root', 3, false);
                if (rootResponse.success) {
                    userSlot = findUserSlot(rootResponse.data);
                }
            }

            if (!userSlot) {
                return res.send(`Error: User "${username}" not found. / エラー: "${username}" というユーザーが見つかりませんでした。`);
            }

            console.log(`[FindBlendShape] Found user slot: ${getSlotName(userSlot)} (${userSlot.id})`);
            const userDeepResponse = await client.getSlot(userSlot.id, 10, false);
            if (!userDeepResponse.success) throw new Error('Failed to get user slot children');

            const findFaceTrackSlot = (slot) => {
                const name = getSlotName(slot);
                if (name.includes('FaceTrack_ver')) return slot;
                if (slot.children) {
                    for (const child of slot.children) {
                        const found = findFaceTrackSlot(child);
                        if (found) return found;
                    }
                }
                return null;
            };

            const faceTrackSlot = findFaceTrackSlot(userDeepResponse.data);
            if (!faceTrackSlot) {
                return res.send(`Error: FaceTrack_ver slot not found under user "${username}". / エラー: "${username}" の下に FaceTrack_ver スロットが見つかりませんでした。`);
            }

            const faceTrackDetail = await client.getSlot(faceTrackSlot.id, 2, true);
            if (!faceTrackDetail.success) throw new Error('Failed to get FaceTrack slot details');

            const parentId = faceTrackDetail.data.parent?.targetId;
            if (!parentId) {
                return res.send('Error: FaceTrack parent (avatar) not found. / エラー: FaceTrack の親（アバター）が見つかりませんでした。');
            }

            const avatarResponse = await client.getSlot(parentId, 4, true);
            if (!avatarResponse.success) throw new Error('Failed to get avatar slot');

            const avatarSlot = avatarResponse.data;
            console.log(`[FindBlendShape] Found avatar: ${getSlotName(avatarSlot)} (${avatarSlot.id})`);

            const smrPick = await pickSkinnedMeshRenderer(client, avatarSlot);
            if (!smrPick) throw new Error('SkinnedMeshRenderer not found in avatar');
            const smr = smrPick.component;

            driverId = `BlendShapeFinder_${Date.now()}`;
            const addResult = await client.addComponent(
                faceTrackSlot.id,
                '[FrooxEngine]FrooxEngine.DynamicBlendShapeDriver',
                {
                    Renderer: {
                        $type: 'reference',
                        targetId: smr.id,
                        targetType: SMR_TYPE
                    },
                    BlendShapes: {
                        $type: 'list',
                        elements: [
                            {
                                $type: 'syncObject',
                                members: {
                                    BlendShapeName: { $type: 'string', value: shapeName },
                                    Value: { $type: 'float', value: 0.0 }
                                }
                            }
                        ]
                    }
                },
                driverId
            );

            if (!addResult.success) {
                return res.status(500).send(`Error: Failed to add DynamicBlendShapeDriver (${addResult.errorInfo || 'unknown error'}).`);
            }

            await client.updateComponent(driverId, {
                Renderer: {
                    $type: 'reference',
                    targetId: smr.id,
                    targetType: SMR_TYPE
                },
                BlendShapes: {
                    $type: 'list',
                    elements: [
                        {
                            $type: 'syncObject',
                            members: {
                                BlendShapeName: { $type: 'string', value: shapeName },
                                Value: { $type: 'float', value: 0.0 }
                            }
                        }
                    ]
                }
            });

            await new Promise(resolve => setTimeout(resolve, 1000));
            const driverDetail = await client.getComponent(driverId);
            if (!driverDetail.success) throw new Error('Failed to get DynamicBlendShapeDriver details');

            const blendShapes = driverDetail.data.members?.BlendShapes;
            const element = blendShapes?.elements?.[0];
            const elementMembers = element?.members || element?.Members || null;
            const valueMember = elementMembers?.Value || elementMembers?.value || null;
            const fieldId = valueMember?.id || null;
            const blendShapeNameMember = elementMembers?.BlendShapeName || null;
            const resolvedName = blendShapeNameMember?.value || blendShapeNameMember?.Value || null;

            res.json({
                success: true,
                shapeName,
                fieldId,
                driverId,
                elementType: element?.$type || null,
                elementMembersKeys: elementMembers ? Object.keys(elementMembers) : [],
                resolvedName,
                blendShapeNameMember,
                valueMember,
                notes: fieldId ? 'BlendShape field resolved.' : 'BlendShape field not resolved.'
            });
        } catch (error) {
            console.error('[FindBlendShape] Error:', error.message);
            res.status(500).json({
                success: false,
                error: error.message,
                shapeName
            });
        } finally {
            if (driverId) {
                try {
                    await getResoniteClient().removeComponent(driverId);
                } catch (err) {
                    console.log(`[FindBlendShape] Cleanup failed: ${err.message}`);
                }
            }
            setIsSettingUp(false);
            console.log('[FindBlendShape] Finished');
        }
    };

    const handleSetupArkit = async (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const username = req.query.username;
        const port = parseInt(req.query.port, 10) || defaultResonitePort;
        const limit = parseInt(req.query.limit || ARKIT_BLENDSHAPES.length, 10);
        const debugSelf = req.query.debugSelf === '1';
        const noType = req.query.noType === '1';
        const batch = parseInt(req.query.batch || 8, 10);

        if (!username) {
            return res.status(400).send('Error: Username parameter required / エラー: usernameパラメータが必須です。');
        }

        if (getIsSettingUp()) {
            return res.send('Error: Setup is already in progress. / エラー: セットアップが既に進行中です。');
        }

        setIsSettingUp(true);

        try {
            const result = await runArkitSetup({
                username,
                port,
                limit,
                debugSelf,
                noType,
                batch
            });
            res.json(result);
        } catch (error) {
            console.error('[ARKit Setup] Error:', error.message);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            setIsSettingUp(false);
            console.log('[ARKit Setup] Finished');
        }
    };

    const registerArkitRoutes = (app) => {
        app.get('/find-blendshape', handleFindBlendshape);
        app.get('/setup-arkit', handleSetupArkit);
    };

    return {
        runArkitSetup,
        registerArkitRoutes
    };
}
