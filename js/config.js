// ==========================================
// 城市规划与基础配置 (config.js)
// ==========================================

// --- 网格与尺寸规划 ---
export const GRID = 18; // 城市由多少个区块(Block)的网格组成
export const BS = 6;    // 每个区块的边长 (Block Size)
export const RW = 1.6;  // 道路的宽度 (Road Width)
export const CELL = BS + RW; // 单个单元格的完整尺寸（区块 + 道路）
export const HG = Math.floor(GRID / 2); // 半边长，用于以中心点进行双向循环
export const SPAN = GRID * CELL; // 整个城市的物理跨度
export const HALF = SPAN / 2; // 半跨度，用于计算相对于中心的偏移

// --- 主题公园规划 (位于网格右下角，靠近相机方向) ---
export const PK_MIN = HG - 5;
export const PK_MAX = HG - 1;

/**
 * 判断指定的网格坐标 (i, j) 是否位于公园区域内
 * @param {number} i - X轴网格索引
 * @param {number} j - Z轴网格索引
 * @returns {boolean}
 */
export function isPark(i, j) {
    return i >= PK_MIN && i <= PK_MAX && j >= PK_MIN && j <= PK_MAX;
}

// --- 湖泊定义 (世界空间坐标系下的 X, Z 和半径) ---
export const LAKES = [
    // { wx: -50, wz: -35, rx: 12, rz: 9 },   // 西侧主湖泊 (已移除，腾空巨型厂房占地)
    { wx: 45, wz: -45, rx: 7, rz: 5 },     // 东侧湖泊
    { wx: -35, wz: 30, rx: 5, rz: 7 },     // 西北侧池塘 (恢复该池塘，因为它其实不在工厂片区)
];

/**
 * 判断指定的世界坐标 (wx, wz) 是否距离任何一个湖泊中心过近
 * @param {number} wx - 世界坐标系 X
 * @param {number} wz - 世界坐标系 Z
 * @returns {boolean}
 */
export function inLakeZone(wx, wz) {
    return LAKES.some(l => {
        // 使用椭圆方程归一化距离
        const dx = (wx - l.wx) / l.rx;
        const dz = (wz - l.wz) / l.rz;
        // 小于 2.4 表示在这个湖泊的保护范围内，推远周围的民居和道路
        return dx * dx + dz * dz < 2.4;
    });
}

// --- 光照与颜色调色板 (区分白天、黄昏、夜晚) ---
export const PAL = {
    day: {
        sky: 0x87ceeb, fog: 0xaac8e8, ambC: 0xffeedd, ambI: 0.9,
        sunC: 0xffffff, sunI: 2.0, hS: 0x87ceeb, hG: 0x3d7a3d,
        wEI: 0.15, lEI: 0.5, wCol: 0x3a9acc, wA: 0.82
    },
    dusk: {
        sky: 0xee6633, fog: 0xbb4422, ambC: 0xff8844, ambI: 0.6,
        sunC: 0xff9944, sunI: 1.3, hS: 0xee5500, hG: 0x5a4a2a,
        wEI: 0.7, lEI: 1.1, wCol: 0x226688, wA: 0.88
    },
    night: {
        sky: 0x020814, fog: 0x050d1e, ambC: 0x2233aa, ambI: 0.3,
        sunC: 0x4466bb, sunI: 0.25, hS: 0x112244, hG: 0x1a2235,
        wEI: 1.5, lEI: 2.0, wCol: 0x0a2233, wA: 0.92
    },
};
