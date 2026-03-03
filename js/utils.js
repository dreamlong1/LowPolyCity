// ==========================================
// 工具函数 (utils.js)
// ==========================================

/**
 * 生成 [a, b) 范围内的随机浮点数
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export const R = (a, b) => a + Math.random() * (b - a);

/**
 * 生成 [a, b] 范围内的随机整数
 * @param {number} a 
 * @param {number} b 
 * @returns {number}
 */
export const RI = (a, b) => Math.floor(R(a, b + 0.999));

/**
 * 从数组中随机挑选一个元素
 * @param {Array} a 
 * @returns {*}
 */
export const rp = a => a[Math.floor(Math.random() * a.length)];

/**
 * 顶点抖动函数 (Jitter)
 * 对给定的 BufferGeometry 进行微小的随机偏移，以形成低多边形 (Low Poly) 粗糙的质感
 * @param {THREE.BufferGeometry} g - Three.js 的几何体 
 * @param {number} [s=0.08] - 抖动的最大幅度
 */
export function jitter(g, s = 0.08) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        p.setXYZ(
            i,
            p.getX(i) + R(-s, s),
            p.getY(i) + R(-s, s),
            p.getZ(i) + R(-s, s)
        );
    }
    p.needsUpdate = true;
    g.computeVertexNormals(); // 重新计算法线，以便正确受光
}

/**
 * 更新加载界面的进度条
 * @param {number} v - 进度值 0~1
 */
export function prog(v) {
    const b = document.getElementById('lbar');
    if (b) b.style.width = `${Math.min(100, v * 100)}%`;
}
