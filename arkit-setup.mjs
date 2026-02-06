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

// VRCFT Unified Expressions - Base Shapes (ARKitに存在しないもののみ)
const UNIFIED_BASE_SHAPES = [
    // 眼球（ARKitと命名が同じものは除外）
    'EyeClosedRight', 'EyeClosedLeft',  // ARKitでは eyeBlinkRight/Left
    'EyeLookOutRight', 'EyeLookInRight', 'EyeLookUpRight', 'EyeLookDownRight',
    'EyeLookOutLeft', 'EyeLookInLeft', 'EyeLookUpLeft', 'EyeLookDownLeft',
    'EyeSquintRight', 'EyeSquintLeft', 'EyeWideRight', 'EyeWideLeft',
    // 瞳孔
    'EyeDilationRight', 'EyeDilationLeft', 'EyeConstrictRight', 'EyeConstrictLeft',
    // 眉毛
    'BrowPinchRight', 'BrowPinchLeft', 'BrowLowererRight', 'BrowLowererLeft',
    'BrowInnerUpRight', 'BrowInnerUpLeft', 'BrowOuterUpRight', 'BrowOuterUpLeft',
    // 鼻
    'NoseSneerRight', 'NoseSneerLeft',
    'NasalDilationRight', 'NasalDilationLeft', 'NasalConstrictRight', 'NasalConstrictLeft',
    // 頬
    'CheekSquintRight', 'CheekSquintLeft', 'CheekPuffRight', 'CheekPuffLeft',
    'CheekSuckRight', 'CheekSuckLeft',
    // 顎
    'JawOpen', 'MouthClosed', 'JawRight', 'JawLeft', 'JawForward',
    'JawBackward', 'JawClench', 'JawMandibleRaise',
    // 唇
    'LipSuckUpperRight', 'LipSuckUpperLeft', 'LipSuckLowerRight', 'LipSuckLowerLeft',
    'LipSuckCornerRight', 'LipSuckCornerLeft',
    'LipFunnelUpperRight', 'LipFunnelUpperLeft', 'LipFunnelLowerRight', 'LipFunnelLowerLeft',
    'LipPuckerUpperRight', 'LipPuckerUpperLeft', 'LipPuckerLowerRight', 'LipPuckerLowerLeft',
    // 口
    'MouthUpperUpRight', 'MouthUpperUpLeft', 'MouthLowerDownRight', 'MouthLowerDownLeft',
    'MouthUpperDeepenRight', 'MouthUpperDeepenLeft',
    'MouthUpperRight', 'MouthUpperLeft', 'MouthLowerRight', 'MouthLowerLeft',
    'MouthCornerPullRight', 'MouthCornerPullLeft', 'MouthCornerSlantRight', 'MouthCornerSlantLeft',
    'MouthFrownRight', 'MouthFrownLeft', 'MouthStretchRight', 'MouthStretchLeft',
    'MouthDimpleRight', 'MouthDimpleLeft', 'MouthRaiserUpper', 'MouthRaiserLower',
    'MouthPressRight', 'MouthPressLeft', 'MouthTightenerRight', 'MouthTightenerLeft',
    // 舌
    'TongueOut', 'TongueUp', 'TongueDown', 'TongueRight', 'TongueLeft',
    'TongueRoll', 'TongueBendDown', 'TongueCurlUp', 'TongueSquish',
    'TongueFlat', 'TongueTwistRight', 'TongueTwistLeft',
    // その他
    'SoftPalateClose', 'ThroatSwallow', 'NeckFlexRight', 'NeckFlexLeft'
];

// VRCFT Unified Expressions - Blended Shapes (左右統合など)
const UNIFIED_BLENDED_SHAPES = [
    // 目
    'EyeClosed', 'EyeWide', 'EyeSquint', 'EyeDilation', 'EyeConstrict',
    // 眉毛
    'BrowDownRight', 'BrowDownLeft', 'BrowDown', 'BrowInnerUp',
    'BrowUpRight', 'BrowUpLeft', 'BrowUp',
    // 鼻
    'NoseSneer', 'NasalDilation', 'NasalConstrict',
    // 頬
    'CheekPuff', 'CheekSuck', 'CheekSquint',
    // 唇
    'LipSuckUpper', 'LipSuckLower', 'LipSuck',
    'LipFunnelUpper', 'LipFunnelLower', 'LipFunnel',
    'LipPuckerUpper', 'LipPuckerLower', 'LipPucker',
    // 口
    'MouthUpperUp', 'MouthLowerDown', 'MouthOpen',
    'MouthRight', 'MouthLeft',
    'MouthSmileRight', 'MouthSmileLeft', 'MouthSmile',
    'MouthSadRight', 'MouthSadLeft', 'MouthSad',
    'MouthStretch', 'MouthDimple', 'MouthTightener', 'MouthPress'
];

// 統合: 全Unified Blendshapes（ARKitにないもの）
const UNIFIED_ONLY_BLENDSHAPES = [...UNIFIED_BASE_SHAPES, ...UNIFIED_BLENDED_SHAPES];

// ARKit から Unified へのマッピング (https://docs.vrcft.io/docs/tutorial-avatars/tutorial-avatars-extras/compatibility/arkit)
const ARKIT_TO_UNIFIED_MAP = {
    'eyeLookUpRight': 'EyeLookUpRight',
    'eyeLookDownRight': 'EyeLookDownRight',
    'eyeLookInRight': 'EyeLookInRight',
    'eyeLookOutRight': 'EyeLookOutRight',
    'eyeLookUpLeft': 'EyeLookUpLeft',
    'eyeLookDownLeft': 'EyeLookDownLeft',
    'eyeLookInLeft': 'EyeLookInLeft',
    'eyeLookOutLeft': 'EyeLookOutLeft',
    'eyeBlinkRight': 'EyeClosedRight',
    'eyeBlinkLeft': 'EyeClosedLeft',
    'eyeSquintRight': 'EyeSquintRight',
    'eyeSquintLeft': 'EyeSquintLeft',
    'eyeWideRight': 'EyeWideRight',
    'eyeWideLeft': 'EyeWideLeft',
    'browDownRight': 'BrowDownRight',
    'browDownLeft': 'BrowDownLeft',
    'browInnerUp': 'BrowInnerUp',
    'browOuterUpRight': 'BrowOuterUpRight',
    'browOuterUpLeft': 'BrowOuterUpLeft',
    'noseSneerRight': 'NoseSneerRight',
    'noseSneerLeft': 'NoseSneerLeft',
    'cheekSquintRight': 'CheekSquintRight',
    'cheekSquintLeft': 'CheekSquintLeft',
    'cheekPuff': 'CheekPuff',
    'jawOpen': 'JawOpen',
    'mouthClose': 'MouthClosed',
    'jawRight': 'JawRight',
    'jawLeft': 'JawLeft',
    'jawForward': 'JawForward',
    'mouthRollUpper': 'LipSuckUpper',
    'mouthRollLower': 'LipSuckLower',
    'mouthFunnel': 'LipFunnel',
    'mouthPucker': 'LipPucker',
    'mouthUpperUpRight': 'MouthUpperUpRight',
    'mouthUpperUpLeft': 'MouthUpperUpLeft',
    'mouthLowerDownRight': 'MouthLowerDownRight',
    'mouthLowerDownLeft': 'MouthLowerDownLeft',
    'mouthSmileRight': 'MouthSmileRight',
    'mouthSmileLeft': 'MouthSmileLeft',
    'mouthFrownRight': 'MouthFrownRight',
    'mouthFrownLeft': 'MouthFrownLeft',
    'mouthStretchRight': 'MouthStretchRight',
    'mouthStretchLeft': 'MouthStretchLeft',
    'mouthDimpleRight': 'MouthDimpleRight',
    'mouthDimpleLeft': 'MouthDimpleLeft',
    'mouthShrugUpper': 'MouthRaiserUpper',
    'mouthShrugLower': 'MouthRaiserLower',
    'mouthPressRight': 'MouthPressRight',
    'mouthPressLeft': 'MouthPressLeft',
    'tongueOut': 'TongueOut'
};

// 全ブレンドシェイプ名のリスト（OSCパス検出用）
// 全ブレンドシェイプ名のリスト（OSCパス検出用、重複除去）
const ALL_BLENDSHAPE_NAMES = [...new Set([...ARKIT_BLENDSHAPES, ...UNIFIED_ONLY_BLENDSHAPES, ...Object.values(ARKIT_TO_UNIFIED_MAP)])];

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

    // Check if it ends with any of the known blendshape names (ARKit + Unified, case-insensitive)
    const lowerTrimmed = trimmed.toLowerCase();
    for (const shape of ALL_BLENDSHAPE_NAMES) {
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
    const seen = new Set();

    for (const name of shapeNames) {
        // 大文字開始バリアントも追加
        const variants = [name];
        if (name && name.length > 0) {
            const capitalized = name[0].toUpperCase() + name.slice(1);
            if (capitalized !== name) {
                variants.push(capitalized);
            }
        }

        for (const variant of variants) {
            if (!seen.has(variant)) {
                seen.add(variant);
                candidates.push(variant);
            }
        }
    }

    // aliasMapは不要（見つかった名前をそのまま使う）
    return { candidates, aliasMap: null };
}

async function resolveBlendShapeFields(client, faceSlotId, smrId, shapeNames, nameAliasMap = null, driverId = null) {
    const resolved = {};
    let finalDriverId = driverId || `BlendShapeFinder_${Date.now()}`;
    const elements = shapeNames.map(name => ({
        $type: 'syncObject',
        members: {
            BlendShapeName: { $type: 'string', value: name },
            Value: { $type: 'float', value: 0.0 }
        }
    }));

    let finalActualDriverId = finalDriverId;
    const addResult = await client.addComponent(
        faceSlotId,
        '[FrooxEngine]FrooxEngine.DynamicBlendShapeDriver',
        {
            Renderer: { $type: 'reference', targetId: smrId, targetType: SMR_TYPE },
            BlendShapes: { $type: 'list', elements: elements }
        },
        finalDriverId
    );

    if (!addResult.success) {
        if (addResult.errorInfo && addResult.errorInfo.includes('ID')) {
            finalActualDriverId = `${finalDriverId}_${Date.now()}`;
            const retry = await client.addComponent(
                faceSlotId,
                '[FrooxEngine]FrooxEngine.DynamicBlendShapeDriver',
                {
                    Renderer: { $type: 'reference', targetId: smrId, targetType: SMR_TYPE },
                    BlendShapes: { $type: 'list', elements: elements }
                },
                finalActualDriverId
            );
            if (!retry.success) {
                throw new Error(`Failed to add DynamicBlendShapeDriver: ${retry.errorInfo || 'unknown error'}`);
            }
        } else {
            // If it's another error, try updating the existing one instead
            const updateResult = await client.updateComponent(finalActualDriverId, {
                Renderer: { $type: 'reference', targetId: smrId, targetType: SMR_TYPE },
                BlendShapes: { $type: 'list', elements: elements }
            });
            if (!updateResult.success) {
                throw new Error(`Failed to update DynamicBlendShapeDriver: ${updateResult.errorInfo || 'unknown error'}`);
            }
        }
    }

    // Wait for component to be created, then explicitly update BlendShapes to ensure names are set
    await new Promise(resolve => setTimeout(resolve, 500));

    // Fetch the created component to get element IDs
    const initialDetail = await client.getComponent(finalActualDriverId);
    if (initialDetail.success) {
        const existingElements = initialDetail.data.members?.BlendShapes?.elements || [];

        // Build update payload with existing element IDs to preserve structure
        const updateElements = shapeNames.map((name, index) => {
            const existingElement = existingElements[index];
            const existingMembers = existingElement?.members || {};
            return {
                $type: 'syncObject',
                ...(existingElement?.id ? { id: existingElement.id } : {}),
                members: {
                    BlendShapeName: {
                        $type: 'string',
                        value: name,
                        ...(existingMembers.BlendShapeName?.id ? { id: existingMembers.BlendShapeName.id } : {})
                    },
                    Value: {
                        $type: 'float',
                        value: 0.0,
                        ...(existingMembers.Value?.id ? { id: existingMembers.Value.id } : {})
                    }
                }
            };
        });

        // Update BlendShapes with names
        const nameUpdateResult = await client.updateComponent(finalActualDriverId, {
            BlendShapes: {
                $type: 'list',
                elements: updateElements,
                ...(initialDetail.data.members?.BlendShapes?.id ? { id: initialDetail.data.members.BlendShapes.id } : {})
            }
        });

        if (!nameUpdateResult.success) {
            console.warn(`[ARKit Setup] BlendShapes update warning: ${nameUpdateResult.errorInfo || 'unknown'}`);
        }

        // CRITICAL: Reset Renderer to trigger _drive linking
        // Setting Renderer to null then back to SMR causes DynamicBlendShapeDriver to re-resolve targets
        const rendererId = initialDetail.data.members?.Renderer?.id;
        if (rendererId) {
            await new Promise(resolve => setTimeout(resolve, 300));

            // Set Renderer to null
            await client.updateComponent(finalActualDriverId, {
                Renderer: {
                    $type: 'reference',
                    targetId: null,
                    id: rendererId
                }
            });

            await new Promise(resolve => setTimeout(resolve, 300));

            // Set Renderer back to SMR to trigger target resolution
            await client.updateComponent(finalActualDriverId, {
                Renderer: {
                    $type: 'reference',
                    targetId: smrId,
                    targetType: SMR_TYPE,
                    id: rendererId
                }
            });

            console.log(`[ARKit Setup] Renderer reset to trigger _drive linking`);
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

            // Get the _drive reference which points to the actual SMR blendshape field
            // This member is managed by DynamicBlendShapeDriver once it matches the name
            const driveMember = members._drive || members.Drive || null;
            const driveTargetId = (driveMember?.$type === 'reference' || driveMember?.targetId)
                ? (driveMember.targetId || driveMember.TargetID)
                : null;

            // IMPORTANT: Only use _drive.targetId (SMR field), never fallback to Value.id (DBD field)
            // If _drive is null, it means BlendShapeName wasn't matched yet
            const fieldId = driveTargetId;

            // 見つかった名前をそのまま使う（aliasMapによる変換はしない）
            const foundName = resolvedName || shapeNames[index] || null;

            if (foundName && fieldId) {
                localResolved[foundName] = fieldId;
            }
        });

        return { localResolved, elementsOut };
    };

    let lastResolved = {};
    let namesPopulated = false;
    let lastResolvedCount = 0;
    let noChangeCount = 0;

    // Extended polling to ensure DynamicBlendShapeDriver has time to link names
    for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const driverDetail = await client.getComponent(finalActualDriverId);
        if (!driverDetail.success) continue;

        // First check if BlendShapeNames are populated
        const elementsCheck = driverDetail.data.members?.BlendShapes?.elements || [];
        const populatedNames = elementsCheck.filter(el => {
            const name = el?.members?.BlendShapeName?.value || el?.members?.BlendShapeName?.Value;
            return name && name !== null;
        }).length;

        if (!namesPopulated && populatedNames > 0) {
            namesPopulated = true;
            console.log(`[ARKit Setup] BlendShapeNames populated: ${populatedNames}/${shapeNames.length}`);
        }

        // Only check _drive links after names are populated
        if (namesPopulated) {
            const { localResolved } = parseDriver(driverDetail);
            const resolvedCount = Object.keys(localResolved).length;

            lastResolved = localResolved;

            // 全て解決したら即終了
            if (resolvedCount === shapeNames.length) {
                console.log(`[ARKit Setup] _drive links established: ${resolvedCount}/${shapeNames.length}`);
                break;
            }

            // 変化がなければカウント、3回連続変化なしなら終了
            if (resolvedCount === lastResolvedCount) {
                noChangeCount++;
                if (noChangeCount >= 3 && resolvedCount > 0) {
                    console.log(`[ARKit Setup] Early exit (no changes): ${resolvedCount}/${shapeNames.length}`);
                    break;
                }
            } else {
                noChangeCount = 0;
            }
            lastResolvedCount = resolvedCount;
        }
    }

    if (Object.keys(lastResolved).length === 0) {
        console.warn(`[ARKit Setup] Warning: No blendshapes resolved. BlendShapeNames may not match SMR blendshape names.`);
    }

    console.log(`[ARKit Setup] Resolved blendshapes: ${Object.keys(lastResolved).length}/${shapeNames.length}`);
    return { driverId: finalActualDriverId, resolved: lastResolved };
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
    const buildUserLabel = (username, userSlotId) => {
        if (username) return username;
        if (userSlotId) return `id:${userSlotId}`;
        return 'unknown';
    };

    const SKIP_SLOTS = ['Undo Manager', '__TEMP'];
    const findUserSlotCandidates = (slot, username) => {
        if (!slot) return [];
        const results = [];
        const slotName = getSlotName(slot);
        if (SKIP_SLOTS.includes(slotName)) {
            return results;
        }
        if (slotName && slotName.startsWith('User') && slotName.includes(username)) {
            results.push(slot);
        }
        if (slot.children) {
            for (const child of slot.children) {
                results.push(...findUserSlotCandidates(child, username));
            }
        }
        return results;
    };

    const verifyUserSlot = async (client, candidate) => {
        const detail = await client.getSlot(candidate.id, 0, true);
        if (!detail.success || !detail.data.components) return false;
        return detail.data.components.some(c =>
            (c.type || c.componentType || '').includes('UserRoot')
        );
    };

    const resolveUserSlot = async (client, { username, userSlotId }) => {
        if (userSlotId) {
            const userSlotResponse = await client.getSlot(userSlotId, 0, false);
            if (!userSlotResponse.success || !userSlotResponse.data) {
                throw new Error(`Failed to get user slot by id "${userSlotId}".`);
            }
            return userSlotResponse.data;
        }

        if (!username) {
            throw new Error('Username parameter required');
        }

        let rootResponse = await client.getSlot('Root', 1, false);
        if (!rootResponse.success) throw new Error('Failed to get root slot');

        let candidates = findUserSlotCandidates(rootResponse.data, username);
        if (candidates.length === 0) {
            rootResponse = await client.getSlot('Root', 3, false);
            if (rootResponse.success) {
                candidates = findUserSlotCandidates(rootResponse.data, username);
            }
        }

        for (const candidate of candidates) {
            console.log(`[ARKit Setup] Verifying candidate: ${getSlotName(candidate)} (${candidate.id})...`);
            if (await verifyUserSlot(client, candidate)) {
                console.log(`[ARKit Setup] -> Confirmed (has UserRoot component)`);
                return candidate;
            }
            console.log(`[ARKit Setup] -> Rejected (no UserRoot component)`);
        }

        throw new Error(`User "${username}" not found.`);
    };

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
        userSlotId,
        port = defaultResonitePort,
        limit = ALL_BLENDSHAPE_NAMES.length,
        debugSelf = false,
        noType = false,
        batch = 999
    }) => {
        if (!username && !userSlotId) {
            throw new Error('Username or userSlotId parameter required');
        }

        // 全ブレンドシェイプ名（ARKit + Unified）を探索対象にする
        const shapeLimit = Math.max(1, Math.min(parseInt(limit, 10), ALL_BLENDSHAPE_NAMES.length));
        const shapeList = ALL_BLENDSHAPE_NAMES.slice(0, shapeLimit);
        const batchSize = Math.max(1, Math.min(parseInt(batch, 10), shapeList.length));

        const userLabel = buildUserLabel(username, userSlotId);
        console.log(`[ARKit Setup] Starting setup for user: ${userLabel} (port: ${port})`);

        const client = await ensureConnected(port);

        const userSlot = await resolveUserSlot(client, { username, userSlotId });

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
            throw new Error(`FaceTrack_ver slot not found under user "${userLabel}".`);
        }

        const faceTrackDetail = await client.getSlot(faceTrackSlot.id, 2, true);
        if (!faceTrackDetail.success) throw new Error('Failed to get FaceTrack slot details');

        const faceSlot = findChildByName(faceTrackDetail.data, 'Face');
        if (!faceSlot) {
            throw new Error('Face slot not found under FaceTrack_ver.');
        }

        const faceDetail = await client.getSlot(faceSlot.id, 2, true);
        if (!faceDetail.success) throw new Error('Failed to get Face slot details');

        // Find Eye Manager and setup eye tracking
        console.log('[ARKit Setup] Searching for Eye Manager...');
        let eyeCloseOverrideIds = { Left: null, Right: null };
        let eyeManagerSetupResult = '';
        
        const findAndSetupEyeManager = async (avatarSlotData) => {
            const searchInSlot = (slot) => {
                if (!slot) return null;
                const slotName = getSlotName(slot);
                if (slotName === 'Eye Manager' || slotName.includes('Eye Manager')) {
                    return slot;
                }
                if (slot.children) {
                    for (const child of slot.children) {
                        const found = searchInSlot(child);
                        if (found) return found;
                    }
                }
                return null;
            };
            
            const eyeManagerSlot = searchInSlot(avatarSlotData);
            if (!eyeManagerSlot) {
                console.log('[ARKit Setup] Eye Manager slot not found');
                return null;
            }
            console.log(`[ARKit Setup] Eye Manager slot found: name="${getSlotName(eyeManagerSlot)}" id=${eyeManagerSlot.id}`);
            
            const eyeManagerDetail = await client.getSlot(eyeManagerSlot.id, 0, true);
            if (!eyeManagerDetail.success || !eyeManagerDetail.data.components) {
                console.log('[ARKit Setup] Failed to get Eye Manager components');
                return null;
            }
            const componentTypes = eyeManagerDetail.data.components.map(c => c.type || c.componentType || 'Unknown');
            console.log(`[ARKit Setup] Eye Manager components (${componentTypes.length}): ${componentTypes.join(', ')}`);
            
            // Setup 1: Disable auto-blink in EyeManager
            const eyeManagerComp = eyeManagerDetail.data.components.find(c => {
                const type = c.type || c.componentType || '';
                return type.includes('EyeManager');
            });
            
            if (eyeManagerComp) {
                try {
                    console.log('[ARKit Setup] EyeManager: disabling auto-blink (Min/MaxBlinkInterval -> Infinity)');
                    const updateResult = await client.updateComponent(eyeManagerComp.id, {
                        MinBlinkInterval: { $type: 'float', value: 'Infinity' },
                        MaxBlinkInterval: { $type: 'float', value: 'Infinity' }
                    });
                    if (updateResult.success) {
                        eyeManagerSetupResult = ' EyeManager: Auto-blink disabled.';
                        console.log('[ARKit Setup] EyeManager: Min/MaxBlinkInterval set to Infinity');
                    } else {
                        console.warn(`[ARKit Setup] EyeManager: update failed (${updateResult.errorInfo || 'unknown error'})`);
                    }
                } catch (err) {
                    console.error('[ARKit Setup] Error updating EyeManager:', err.message);
                }

                console.log(`[ARKit Setup] EyeManager component id=${eyeManagerComp.id}`);
                const memberKeys = Object.keys(eyeManagerComp.members || {});
                if (memberKeys.length > 0) {
                    console.log(`[ARKit Setup] EyeManager member keys: ${memberKeys.join(', ')}`);
                }
                const leftOverrideKey = getMemberKey(eyeManagerComp.members, 'lefteyecloseoverride', 'LeftEyeCloseOverride');
                const rightOverrideKey = getMemberKey(eyeManagerComp.members, 'righteyecloseoverride', 'RightEyeCloseOverride');
                console.log(`[ARKit Setup] EyeCloseOverride keys: L=${leftOverrideKey || 'null'} R=${rightOverrideKey || 'null'}`);
                const leftOverrideMember = leftOverrideKey ? eyeManagerComp.members?.[leftOverrideKey] : null;
                const rightOverrideMember = rightOverrideKey ? eyeManagerComp.members?.[rightOverrideKey] : null;
                eyeCloseOverrideIds.Left = leftOverrideMember?.id || leftOverrideMember?.Id || null;
                eyeCloseOverrideIds.Right = rightOverrideMember?.id || rightOverrideMember?.Id || null;

                if (eyeCloseOverrideIds.Left || eyeCloseOverrideIds.Right) {
                    console.log(`[ARKit Setup] EyeCloseOverride IDs: L=${eyeCloseOverrideIds.Left || 'null'} R=${eyeCloseOverrideIds.Right || 'null'}`);
                } else {
                    console.log('[ARKit Setup] EyeCloseOverride IDs not found');
                }
            } else {
                console.log('[ARKit Setup] EyeManager component not found in Eye Manager slot');
            }
            
            return eyeCloseOverrideIds;
        };

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

        // AvatarExpressionDriverを探して削除
        const findAndRemoveAvatarExpressionDriver = async (slot) => {
            if (!slot) return 0;
            let removedCount = 0;

            // このスロットのコンポーネントをチェック
            if (slot.components) {
                for (const component of slot.components) {
                    const type = component.type || component.componentType || '';
                    if (type.includes('AvatarExpressionDriver')) {
                        console.log(`[ARKit Setup] Found AvatarExpressionDriver at ${getSlotName(slot)} (${component.id}), removing...`);
                        try {
                            await client.removeComponent(component.id);
                            console.log(`[ARKit Setup] Removed AvatarExpressionDriver: ${component.id}`);
                            removedCount++;
                        } catch (err) {
                            console.warn(`[ARKit Setup] Failed to remove AvatarExpressionDriver ${component.id}: ${err.message}`);
                        }
                    }
                }
            }

            // 子スロットを再帰的にチェック
            if (slot.children) {
                for (const child of slot.children) {
                    removedCount += await findAndRemoveAvatarExpressionDriver(child);
                }
            }

            return removedCount;
        };

        // アバター全体を深く取得してAvatarExpressionDriverを探す
        const avatarDeepResponse = await client.getSlot(avatarSlot.id, 10, true);
        if (avatarDeepResponse.success) {
            const removedCount = await findAndRemoveAvatarExpressionDriver(avatarDeepResponse.data);
            if (removedCount > 0) {
                console.log(`[ARKit Setup] Removed ${removedCount} AvatarExpressionDriver(s)`);
            } else {
                console.log(`[ARKit Setup] No AvatarExpressionDriver found`);
            }
            
            // Eye Managerを探して設定
            console.log('[ARKit Setup] Setting up Eye Manager...');
            await findAndSetupEyeManager(avatarDeepResponse.data);
        }

        const smrPick = await pickSkinnedMeshRenderer(client, avatarSlot);
        if (!smrPick) throw new Error('SkinnedMeshRenderer not found in avatar');
        const smr = smrPick.component;

        const resolvedMap = {};
        const batches = [];
        const createdDriverIds = [];
        for (let i = 0; i < shapeList.length; i += batchSize) {
            batches.push(shapeList.slice(i, i + batchSize));
        }

        for (let i = 0; i < batches.length; i++) {
            const batchSet = batches[i];
            const { candidates, aliasMap } = buildBlendShapeCandidates(batchSet);
            const driverId = `ARKIT_DBD_${Date.now()}_${i}`;
            const resolveResult = await resolveBlendShapeFields(client, faceSlot.id, smr.id, candidates, aliasMap, driverId);
            Object.assign(resolvedMap, resolveResult.resolved);
            createdDriverIds.push(resolveResult.driverId);
        }

        // Cleanup: Remove temporary DynamicBlendShapeDrivers
        for (const driverId of createdDriverIds) {
            try {
                await client.removeComponent(driverId);
                console.log(`[ARKit Setup] Removed temporary driver: ${driverId}`);
            } catch (err) {
                console.warn(`[ARKit Setup] Failed to remove driver ${driverId}: ${err.message}`);
            }
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
        const idPrefix = `ARKIT_${Date.now()}`;

        // 見つかったブレンドシェイプを処理（見つかった名前をそのまま使う）
        let foundShapes = Object.keys(resolvedMap);
        console.log(`[ARKit Setup] Found ${foundShapes.length} blendshapes in SMR`);
        
        // EyeClosedRight/LeftはEyeCloseOverride経由で直接処理するため、foundShapesに追加
        if (eyeCloseOverrideIds.Right && !foundShapes.includes('EyeClosedRight')) {
            foundShapes = [...foundShapes, 'EyeClosedRight'];
            console.log('[ARKit Setup] Added EyeClosedRight to process (EyeCloseOverride)');
        }
        if (eyeCloseOverrideIds.Left && !foundShapes.includes('EyeClosedLeft')) {
            foundShapes = [...foundShapes, 'EyeClosedLeft'];
            console.log('[ARKit Setup] Added EyeClosedLeft to process (EyeCloseOverride)');
        }

        for (const shapeName of foundShapes) {
            let fieldId = resolvedMap[shapeName];
            
            // EyeClosedRight/Leftの場合、EyeCloseOverrideを使用
            if (shapeName === 'EyeClosedRight' && eyeCloseOverrideIds.Right) {
                fieldId = eyeCloseOverrideIds.Right;
                console.log(`[ARKit Setup] ${shapeName}: Using EyeCloseOverride instead of blendshape`);
            } else if (shapeName === 'EyeClosedLeft' && eyeCloseOverrideIds.Left) {
                fieldId = eyeCloseOverrideIds.Left;
                console.log(`[ARKit Setup] ${shapeName}: Using EyeCloseOverride instead of blendshape`);
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
                continue;
            }
            smoothDriveKey = driveInfo.key;
            smoothValueMemberId = driveInfo.member?.id || null;
            smoothDriveTargetType = driveInfo.member?.targetType || null;

            if (!smoothTargetValueId) {
                console.warn(`[ARKit Setup] SmoothValue target field missing for ${shapeName} (${smoothComponentId}). Members: ${formatMemberSummary(smoothMembers)}`);
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
            foundCount: foundShapes.length,
            eyeManagerResult: eyeManagerSetupResult,
            created,
            updated
        };
    };

    const handleFindBlendshape = async (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        const username = req.query.username;
        const userSlotId = req.query.userSlotId;
        const port = parseInt(req.query.port, 10) || defaultResonitePort;
        const shapeName = req.query.shape || 'JawLeft';

        if (!username && !userSlotId) {
            return res.status(400).send('Error: Username or userSlotId parameter required / エラー: username または userSlotId パラメータが必須です。');
        }

        if (getIsSettingUp()) {
            return res.send('Error: Setup is already in progress. / エラー: セットアップが既に進行中です。');
        }

        setIsSettingUp(true);
        const userLabel = buildUserLabel(username, userSlotId);
        console.log(`[FindBlendShape] Starting search for "${shapeName}" (user: ${userLabel}, port: ${port})`);

        let driverId = null;

        try {
            const client = await ensureConnected(port);
            const userSlot = await resolveUserSlot(client, { username, userSlotId });

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
                return res.send(`Error: FaceTrack_ver slot not found under user "${userLabel}". / エラー: "${userLabel}" の下に FaceTrack_ver スロットが見つかりませんでした。`);
            }

            const faceTrackDetail = await client.getSlot(faceTrackSlot.id, 2, true);
            if (!faceTrackDetail.success) throw new Error('Failed to get FaceTrack slot details');

            const faceSlot = findChildByName(faceTrackDetail.data, 'Face');
            if (!faceSlot) {
                return res.send('Error: Face slot not found under FaceTrack_ver. / エラー: FaceTrack_ver の下に Face スロットが見つかりませんでした。');
            }

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
                faceSlot.id,
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

            // Always perform an explicit update to ensure BlendShapeName strings are set
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
        const userSlotId = req.query.userSlotId;
        const port = parseInt(req.query.port, 10) || defaultResonitePort;
        const limit = parseInt(req.query.limit || ARKIT_BLENDSHAPES.length, 10);
        const debugSelf = req.query.debugSelf === '1';
        const noType = req.query.noType === '1';
        const batch = parseInt(req.query.batch || 999, 10);

        if (!username && !userSlotId) {
            return res.status(400).send('Error: Username or userSlotId parameter required / エラー: username または userSlotId パラメータが必須です。');
        }

        if (getIsSettingUp()) {
            return res.send('Error: Setup is already in progress. / エラー: セットアップが既に進行中です。');
        }

        setIsSettingUp(true);

        try {
            const result = await runArkitSetup({
                username,
                userSlotId,
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
