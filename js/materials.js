import * as THREE from 'three';
import { PAL } from './config.js';

// ==========================================
// 材质与颜色管理 (materials.js)
// ==========================================

// 用于缓存按名字全局保存的所有材质
const MS = new Map();

/**
 * 快速创建或获取缓存的 MeshLambertMaterial
 * @param {string} k - 材质专属键名 
 * @param {number|string} c - 颜色(十六进制数值或css色名)
 * @param {Object} [o={}] - 额外选项参数 
 * @returns {THREE.MeshLambertMaterial} 返回材质对象
 */
export function m(k, c, o = {}) {
    if (!MS.has(k)) {
        MS.set(k, new THREE.MeshLambertMaterial({
            color: c,
            flatShading: true, // 启用扁平着色，低多边形风格的灵魂
            emissive: o.em ?? 0, // 自发光颜色
            emissiveIntensity: o.ei ?? 0, // 自发光强度
            transparent: o.tr ?? false, // 是否透明
            opacity: o.op ?? 1, // 透明度
            side: o.side ?? THREE.FrontSide // 渲染的面（正面，双面等）
        }));
    }
    return MS.get(k);
}

// ==================
// 主题配色字典
// ==================

// BPALS(Building Palettes): 为建筑设定的多种风格调色板 (蓝色系，暖色系，灰暗系，赛博系等)
export const BPALS = [
    [0x4a6fa5, 0x3a5a8f, 0x6a8fc8, 0x2a4a7f, 0x5b80b0],
    [0xe8c8a0, 0xd4a870, 0xf0d0a8, 0xc89060, 0xe0b888],
    [0x708090, 0x607080, 0x809098, 0x506070, 0x788898],
    [0x7ec8a0, 0xa070c0, 0xf0a060, 0x60b8d8, 0xe07070],
    [0xa0aab5, 0xc8d0d8, 0x90a0b0, 0x788898, 0xdcdcdc], // [4] 仍保留原版冷硬灰度金属色（备用）
    [0x8a3324, 0x9b3a2a, 0x7a291b, 0x662216, 0xa54533]  // [5] 专门为新版巨型工厂增加的红砖/铁锈色系
];

// 建筑屋顶的基调配色
export const RCOLORS = [0x3a5a8a, 0xa06840, 0x607070, 0x507860, 0x333340]; // 增加厂房屋顶深空灰

// 城市绿化植被的主色调
export const LCOLORS = [0x2d6a2d, 0x3a8a3a, 0x4aaa4a, 0x1e5a1e, 0x5aaa5a];

// 摩天轮轿厢的颜色列表
export const GCOLS = [0x4488ff, 0xff8844, 0x44cc44, 0xff55ff, 0xffdd00, 0xff4455, 0x44ddff, 0xaaff44];

// 车辆的外壳颜色列表
export const VCOLS = [0xff2222, 0x2266ff, 0xffffff, 0x222222, 0xffcc00, 0x22cc66, 0xff8800, 0xcccccc];

// 公园帐篷的名称键 (已在前面配置相关材质)
export const TK = ['tent0', 'tent1', 'tent2', 'tent3', 'tent4', 'tent5'];

// 行人的身体部位颜色材料池
export const pedBodyMats = ['pBody', 'pBody2', 'pBody3', 'pBody4'];
export const pedHairMats = ['pHair', 'pHair2'];

// 海洋与水域材质 (具有反射高亮但不粗糙的质感)
export const waterMat = new THREE.MeshLambertMaterial({
    color: PAL.day.wCol,
    transparent: true,
    opacity: PAL.day.wA,
    flatShading: false, // 水波不使用硬边扁平着色
    side: THREE.DoubleSide
});

/**
 * 预加载所有预设的材质并全部放入系统缓存
 */
export function initMaterials() {
    // 实例化不同分区块的建筑配色
    BPALS.flat().forEach(c => m(`b${c}`, c));
    RCOLORS.forEach((c, i) => m(`r${i}`, c));

    // 树叶
    LCOLORS.forEach((c, i) => m(`lf${i}`, c));

    // 基础设施
    m('ant', 0x999999); // 天线
    m('win', 0xffee88, { em: 0xffee88, ei: 0.18 }); // 发光窗户
    m('trunk', 0x6b4226); // 树干
    m('road', 0x1c202e); // 沥青道路
    m('lane', 0xffcc44); // 发黄色的公路标线
    m('pole', 0x888888); // 路灯杆
    m('lamp', 0xffffaa, { em: 0xffffaa, ei: 0.6 }); // 路灯灯泡 (开启自发光)

    // 地貌
    m('ground', 0x3d7a3d); // 草地
    m('sand', 0xd4b87a); // 沙滩
    m('parkG', 0x5aaa5a); // 公园中心草地
    m('warnLight', 0xff0000, { em: 0xff0000, ei: 1.5 }); // 工厂高处刺眼的红色航空障碍警示灯

    // 公园游乐设施
    m('tent0', 0xee3333); m('tent1', 0xeecc00); m('tent2', 0x3388ee);
    m('tent3', 0xee44aa); m('tent4', 0x33cc88); m('tent5', 0xff7700);
    m('merryBase', 0xccaaff); m('merryTop', 0xff88cc); // 旋转木马的底板和顶篷

    // 摩天轮
    m('fWheel', 0xdd2222); m('fSpoke', 0xdddddd); m('fLeg', 0x556677);
    GCOLS.forEach((c, i) => m(`gon${i}`, c)); // 安装每一节轿厢的各色材质

    // 车辆相关
    VCOLS.forEach((c, i) => m(`v${i}`, c));
    m('vWheel', 0x222222);
    m('headlight', 0xffffcc, { em: 0xffffcc, ei: 0.8 }); // 汽车前车灯发光

    // 行人相关
    m('pBody', 0x3366aa); m('pBody2', 0xaa3333); m('pBody3', 0x339933); m('pBody4', 0xddaa33);
    m('pSkin', 0xf0c8a0); // 皮肤颜色
    m('pHair', 0x332211);
    m('pHair2', 0x884422); // 偏棕发色
}

/**
 * 暴露对底层 Map 材质容器的获取引用（方便其它代码快速获取指定的缓存材质）
 * @param {string} k - 材质标识
 * @returns {THREE.MeshLambertMaterial}
 */
export function getMat(k) {
    return MS.get(k);
}
