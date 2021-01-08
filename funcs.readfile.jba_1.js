funcs.readFile[FILE_TYPE.JBA] = function readJBA(dv) {
    {
        const magic = dv.getUint32(0x0, !0);
        assert(magic === 0, 'Expected first bytes to be zero but they were ' + magic);
    }
    const duration = dv.getFloat32(0x4, !0);
    const frameRate = dv.getFloat32(0x8, !0);
    const numBlocks = dv.getUint32(0xC, !0);
    {
        const zero2 = dv.getUint32(0x10, !0);
        assert(zero2 === 0, 'Expected 0x10 to be zero but was ' + zero2);
        const zero3 = dv.getUint32(0x14, !0);
        assert(zero3 === 0, 'Expected 0x14 to be zero but was ' + zero3);
    }
    const numBones = dv.getUint32(0x18, !0);
    {
        const zero4 = dv.getUint32(0x1C, !0);
        assert(zero4 === 0, 'Expected 0x1C to be zero but was ' + zero4);
        const unkFFFFFFF0 = dv.getUint32(0x20, !0);
        assert(unkFFFFFFF0 === 0x0FFFFFFF, 'Expected 0x20 to be FF FF FF 0F but was ' + unkFFFFFFF0);
        const zero5 = dv.getUint32(0x24, !0);
        assert(zero5 === 0, 'Expected 0x24 to be zero but was ' + zero5);
    }
    const numFrames = Math.round(duration * frameRate) + 1;
    const rotations = [];
    const translations = [];
    for (let i = 0, il = numFrames; i < il; i++) {
        rotations[i] = [];
        translations[i] = [];
    }
    let pos = 0x28;
    const blocks = [];
    for (let i = 0, il = numBlocks; i < il; i++) {
        const block = Object.create(null);
        block.startingFrame = dv.getUint32(pos, !0);
        pos += 4;
        block.byteLength = dv.getUint32(pos, !0);
        pos += 4;
        blocks[i] = block;
        if (i > 0)
            blocks[i - 1].numFrames = 1 + block.startingFrame - blocks[i - 1].startingFrame;
        if (i + 1 === il)
            block.numFrames = numFrames - block.startingFrame;
    }
    for (let i = 0, il = numBlocks; i < il; i++) {
        const hiddenZero = dv.getUint32(pos);
        pos += 4;
        assert(hiddenZero === 0, 'Expected hidden zero #' + i + ' but saw ' + hiddenZero);
    }
    pos = (pos + 0x7F) & -0x80;
    const bones = [];
    for (let i = 0, il = numBones; i < il; i++) {
        const bone = Object.create(null);
        bone.translStride = vec3.fromValues(dv.getFloat32(pos, !0), dv.getFloat32(pos + 0x4, !0), dv.getFloat32(pos + 0x8, !0));
        bone.translBase = vec3.fromValues(dv.getFloat32(pos + 0xC, !0), dv.getFloat32(pos + 0x10, !0), dv.getFloat32(pos + 0x14, !0));
        bone.rotStride = vec3.fromValues(dv.getFloat32(pos + 0x18, !0), dv.getFloat32(pos + 0x1C, !0), dv.getFloat32(pos + 0x20, !0));
        bone.rotBase = vec3.fromValues(dv.getFloat32(pos + 0x24, !0), dv.getFloat32(pos + 0x28, !0), dv.getFloat32(pos + 0x2C, !0));
        pos += 0x30;
        bones[i] = bone;
    }
    pos = (pos + 0x7F) & -0x80;
    for (let i = 0, il = numBlocks; i < il; i++) {
        const block = blocks[i];
        const posEnd = pos + block.byteLength;
        const blockNumBones = dv.getUint32(pos, !0);
        pos += 4;
        assert(blockNumBones === numBones, 'Expected bones in block to match total bones but they were ' + blockNumBones + ' instead of ' + numBones);
        const blockBonesOffset = dv.getUint32(pos, !0);
        pos += 4;
        assert(blockBonesOffset === 0, 'Expected blockBonesOffset in block #' + i + ' but it was ' + blockBonesOffset);
        block.hasTranslation = [];
        for (let j = 0, jl = blockNumBones; j < jl; j++) {
            const rotationCount = dv.getUint32(pos, !0);
            pos += 4;
            assert(rotationCount === block.numFrames, 'Expected bone num frames to match frames in block but it was ' + rotationCount + ' instead of ' + block.numFrames);
            const rotationOffset = dv.getUint32(pos, !0);
            pos += 4;
            assert(rotationOffset === 0, 'Expected rotation offset for bone to be zero but was ' + rotationOffset);
            const translationCount = dv.getUint32(pos, !0);
            pos += 4;
            assert(translationCount === 0 || translationCount === block.numFrames, 'Expected boneActualFrames to be 0 or ' + block.numFrames + ' but it was ' + translationCount);
            const translationOffset = dv.getUint32(pos, !0);
            pos += 4;
            assert(translationOffset === 0, 'Expected translation offset for bone to be zero but was ' + translationOffset);
            block.hasTranslation[j] = (translationCount !== 0);
        }
        for (let j = 0, jl = numBones; j < jl; j++) {
            const bone = bones[j];
            for (let k = 0, kl = block.numFrames; k < kl; k++) {
                const rotXraw = dv.getUint16(pos, !0);
                const rotX = bone.rotBase[0] + (rotXraw & 0x7FFF) * bone.rotStride[0];
                pos += 2;
                const rotY = bone.rotBase[1] + dv.getUint16(pos, !0) * bone.rotStride[1];
                pos += 2;
                const rotZ = bone.rotBase[2] + dv.getUint16(pos, !0) * bone.rotStride[2];
                pos += 2;
                const rotSum = rotX * rotX + rotY * rotY + rotZ * rotZ;
                let rotW = (rotSum > 1) ? 0 : Math.sqrt(1 - rotSum);
                if ((rotXraw & 0x8000) !== 0)
                    rotW = -rotW;
                const myQuat = quat.fromValues(rotX, rotY, rotZ, rotW);
                quat.normalize(myQuat, myQuat);
                rotations[block.startingFrame + k][j] = myQuat;
            }
            pos = (pos + 0x3) & -4;
            if (block.hasTranslation[j]) {
                for (let k = 0, kl = block.numFrames; k < kl; k++) {
                    const val = dv.getUint32(pos, !0);
                    pos += 4;
                    const posX = bone.translBase[0] + (val >>> 21) * bone.translStride[0];
                    const posY = bone.translBase[1] + ((val >>> 10) & 0x7FF) * bone.translStride[1];
                    const posZ = bone.translBase[2] + (val & 0x3FF) * bone.translStride[2];
                    translations[block.startingFrame + k][j] = vec3.fromValues(posX, posY, posZ);
                }
            } else {
                for (let k = 0, kl = block.numFrames; k < kl; k++) {
                    translations[block.startingFrame + k][j] = vec3.fromValues(bone.translBase[0] + 0x7FF * bone.translStride[0], bone.translBase[1] + 0x7FF * bone.translStride[1], bone.translBase[2] + 0x3FF * bone.translStride[2]);
                }
            }
        }
        pos = posEnd;
    }
    const worldSpace = Object.create(null);
    {
        const zero1 = dv.getUint32(pos, !0);
        pos += 4;
        assert(zero1 === 0, 'Expected first value in settings to be zero but was ' + zero1);
        const frameRateRep = dv.getFloat32(pos, !0);
        pos += 4;
        assert(frameRateRep === frameRate, 'Expected repetition of frame rate but it was ' + frameRateRep + ' instead of ' + frameRate);
        worldSpace.translStride = vec3.fromValues(dv.getFloat32(pos, !0), dv.getFloat32(pos + 0x4, !0), dv.getFloat32(pos + 0x8, !0));
        worldSpace.translBase = vec3.fromValues(dv.getFloat32(pos + 0xC, !0), dv.getFloat32(pos + 0x10, !0), dv.getFloat32(pos + 0x14, !0));
        worldSpace.rotStride = vec3.fromValues(dv.getFloat32(pos + 0x18, !0), dv.getFloat32(pos + 0x1C, !0), dv.getFloat32(pos + 0x20, !0));
        worldSpace.rotBase = vec3.fromValues(dv.getFloat32(pos + 0x24, !0), dv.getFloat32(pos + 0x28, !0), dv.getFloat32(pos + 0x2C, !0));
        pos += 0x30;
        const numRotationData = dv.getUint32(pos, !0);
        pos += 4;
        assert(numRotationData === numFrames, 'Expected numAdditional to be equal to number of frames but it was ' + numRotationData + ' instead of ' + numFrames);
        const rotationOffset = dv.getUint32(pos, !0);
        pos += 4;
        assert(rotationOffset === 0, 'Expected rotationOffset to be zero but was ' + rotationOffset);
        const numTranslationData = dv.getUint32(pos, !0);
        pos += 4;
        assert(numTranslationData === numFrames, 'Expected numTranslationData to be equal to number of frames but it was ' + numTranslationData + ' instead of ' + numFrames);
        const translationOffset = dv.getUint32(pos, !0);
        pos += 4;
        assert(translationOffset === 0, 'Expected translationOffset to be zero but was ' + translationOffset);
        worldSpace.rotations = [];
        for (let i = 0; i < numFrames; i++) {
            const rotXraw = dv.getUint16(pos, !0);
            const rotX = worldSpace.rotBase[0] + (rotXraw & 0x7FFF) * worldSpace.rotStride[0];
            pos += 2;
            const rotY = worldSpace.rotBase[1] + dv.getUint16(pos, !0) * worldSpace.rotStride[1];
            pos += 2;
            const rotZ = worldSpace.rotBase[2] + dv.getUint16(pos, !0) * worldSpace.rotStride[2];
            pos += 2;
            const rotSum = rotX * rotX + rotY * rotY + rotZ * rotZ;
            let rotW = (rotSum > 1) ? 0 : Math.sqrt(1 - rotSum);
            if ((rotXraw & 0x8000) !== 0)
                rotW = -rotW;
            const myQuat = quat.fromValues(rotX, rotY, rotZ, rotW);
            quat.normalize(myQuat, myQuat);
            worldSpace.rotations[i] = myQuat;
        }
        pos = (pos + 0x3) & -4;
        worldSpace.translations = [];
        for (let i = 0; i < numFrames; i++) {
            const val = dv.getUint32(pos, !0);
            pos += 4;
            const posX = worldSpace.translBase[0] + (val >>> 21) * worldSpace.translStride[0];
            const posY = worldSpace.translBase[1] + ((val >>> 10) & 0x7FF) * worldSpace.translStride[1];
            const posZ = worldSpace.translBase[2] + (val & 0x3FF) * worldSpace.translStride[2];
            worldSpace.translations[i] = vec3.fromValues(posX, posY, posZ);
        }
    }
    {
        const nameStart = pos;
        const numStrings = dv.getUint32(pos, !0);
        pos += 4;
        assert(numStrings === numBones, 'Expected numStrings to be identical to numBones but it was ' + numStrings + ' instead of ' + numBones);
        pos += 4;
        const indicesOffset = dv.getUint32(pos, !0);
        pos += 4;
        assert(indicesOffset === 20, 'Expected indicesOffset to be 20 but was ' + indicesOffset);
        const offsetsOffset = dv.getUint32(pos, !0);
        pos += 4;
        assert(offsetsOffset === 20 + 4 * numStrings, 'Expected offsetsOffset to be ' + (20 + 4 * numStrings) + ' but was ' + offsetsOffset);
        const nameStringsOffset = dv.getUint32(pos, !0);
        pos += 4;
        assert(nameStringsOffset === 20 + 8 * numStrings, 'Expected nameStringsOffset to be ' + (20 + 8 * numStrings) + ' but was ' + nameStringsOffset);
        pos = nameStart + indicesOffset;
        for (let i = 0; i < numStrings; i++) {
            const index = dv.getUint32(pos, !0);
            pos += 4;
            assert(index === i, 'Expected string index to match bone index but it was ' + index + ' instead of ' + i);
        }
        pos = nameStart + offsetsOffset;
        for (let i = 0; i < numStrings; i++) {
            const offset = dv.getUint32(pos, !0);
            pos += 4;
            bones[i].name = readString(dv, nameStart + nameStringsOffset + offset);
        }
    }
    return {
        duration,
        frameRate,
        numFrames,
        worldSpace,
        bones,
        rotations,
        translations,
        blocks,
    };
};