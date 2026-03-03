import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, BS, RW, CELL, HG, SPAN, HALF, PK_MIN, PK_MAX, isPark, LAKES, inLakeZone } from './config.js';
import { R, RI, rp, jitter, prog } from './utils.js';
import { getMat, waterMat, m, BPALS, TK } from './materials.js';

// ==========================================
// 静态物理世界与环境生成 (world.js)
// ==========================================

export const lakeMeshes = []; // 全局维护所有的水面实例对象集合
// 专门负责几何体合并 (Geometry Merge) 的采集器
const GB = new Map();

/**
 * 向采集器注册单个物体的几何结构
 * 后期将同材质的所有几何结构合并，通过一个单独的网格实例来渲染，显著降低由成千上万小模型导致的绘制调用数量 (Draw Calls)。
 * @param {string} k - 当前几何体材质组标记 
 * @param {THREE.BufferGeometry} g - 物体几何对象
 */
export function col(k, g) {
    if (!GB.has(k)) GB.set(k, []);
    GB.get(k).push(g);
}

/**
 * 将所有使用相同材质的独立几何体合并成为单一几何组 (Group) 并清空回收
 * @param {boolean} cs - 是否投射阴影
 * @param {boolean} rs - 是否接收阴影
 * @returns {THREE.Group} 组装了数个被合并几何大原型的场景层
 */
export function flush(cs = false, rs = true) {
    const grp = new THREE.Group();
    for (const [k, gs] of GB) {
        if (!gs.length) continue;
        const mg = mergeGeometries(gs, false);
        if (!mg) continue;
        const mesh = new THREE.Mesh(mg, getMat(k));
        mesh.castShadow = cs;
        mesh.receiveShadow = rs;
        grp.add(mesh);
        // 删除已经提取合并了的零散废弃资源，释放显存
        gs.forEach(x => x.dispose());
    }
    GB.clear();
    return grp;
}

/**
 * 构建地形、世界、与建筑群的主要业务逻辑调度
 */
export function buildStaticWorld(scene) {
    let totalB = 0; // 累计建造的建筑数量
    let totalT = 0; // 累计种植的树木数量

    // --- 1. 大地模型阶段 ---
    // 生成巨大的地面网格
    const gndGeo = new THREE.PlaneGeometry(SPAN * 1.3, SPAN * 1.3, 30, 30);
    jitter(gndGeo, 0.1);
    const gndM = new THREE.Mesh(gndGeo, getMat('ground'));
    gndM.rotation.x = -Math.PI / 2; // 地板躺平
    gndM.receiveShadow = true;
    scene.add(gndM);
    // [这部分由于需要支持运行时根据黄昏日夜进行颜色变换，不进行合批]
    exportMeshReference('groundMesh', gndM);


    // --- 3. 水域湖泊阶段 ---
    function makeLake(wx, wz, rx, rz) {
        // 生成具有微多边形效果的平滑椭圆形状
        const pts = new THREE.EllipseCurve(0, 0, rx, rz, 0, Math.PI * 2, false, 0).getPoints(28);
        const geo = new THREE.ShapeGeometry(new THREE.Shape(pts), 12);
        geo.rotateX(-Math.PI / 2);
        jitter(geo, 0.05); // 降低在水面上加的高程颠簸，保持相对平整

        // 由于湖泊可能会被日夜模式直接染成暗灰色，使用新克隆材质并记录
        const mesh = new THREE.Mesh(geo, waterMat.clone());
        mesh.position.set(wx, 0.35, wz); // 将水面高度显著上调，盖过草地的不平整突出部
        scene.add(mesh);
        lakeMeshes.push(mesh);
    }
    LAKES.forEach(l => makeLake(l.wx, l.wz, l.rx, l.rz));
    prog(0.08); // 更新加载界面的进入进度

    // --- 4. 生成公路交通网络 ---
    // 横向马路分段
    for (let i = 0; i <= GRID; i++) {
        const z = -HALF + i * CELL;
        for (let j = -HG; j < HG; j++) {
            const cx = j * CELL + CELL / 2;
            if (!inLakeZone(cx, z)) {
                const g = new THREE.PlaneGeometry(BS, RW);
                g.rotateX(-Math.PI / 2);
                g.translate(cx, 0.01, z);
                col('road', g);
            }
        }
    }
    // 纵向街道分段
    for (let j = 0; j <= GRID; j++) {
        const x = -HALF + j * CELL;
        for (let i = -HG; i < HG; i++) {
            const cz = i * CELL + CELL / 2;
            if (!inLakeZone(x, cz)) {
                const g = new THREE.PlaneGeometry(RW, BS);
                g.rotateX(-Math.PI / 2);
                g.translate(x, 0.01, cz);
                col('road', g);
            }
        }
    }
    // 道路交叉口补齐
    for (let i = 0; i <= GRID; i++) {
        const z = -HALF + i * CELL;
        for (let j = 0; j <= GRID; j++) {
            const x = -HALF + j * CELL;
            if (!inLakeZone(x, z)) {
                const g = new THREE.PlaneGeometry(RW, RW);
                g.rotateX(-Math.PI / 2);
                g.translate(x, 0.01, z);
                col('road', g);
            }
        }
    }

    // 街道中心的黄色双虚线 (沿着中心线做分段小方块)
    for (let i = 0; i <= GRID; i++) {
        const z = -HALF + i * CELL;
        for (let j = -HG; j < HG; j++) {
            const cx = j * CELL + CELL / 2;
            if (!inLakeZone(cx, z)) {
                const g = new THREE.PlaneGeometry(0.12, 1.8);
                g.rotateX(-Math.PI / 2);
                g.translate(cx, 0.02, z);
                col('lane', g);
            }
        }
    }
    for (let j = 0; j <= GRID; j++) {
        const x = -HALF + j * CELL;
        for (let i = -HG; i < HG; i++) {
            const cz = i * CELL + CELL / 2;
            if (!inLakeZone(x, cz)) {
                const g = new THREE.PlaneGeometry(1.8, 0.12);
                g.rotateX(-Math.PI / 2);
                g.translate(x, 0.02, cz);
                col('lane', g);
            }
        }
    }
    prog(0.16);

    // --- 5. 城市基础设施建设阶段 (高楼大厦) ---
    // 计算区块距离，用于决定这个路口建立的是高楼区、居住区，还是城郊外圈的空房。
    function zoneOf(ci, cj) {
        if (ci < -2 && cj < -2 && Math.hypot(ci, cj) > 4.5) return 4;
        const d = Math.hypot(ci, cj);
        if (d < 2.5) return 0; // 核心 CBD
        if (d < 5.5) return 3; // 内环高级公寓
        if (d < 8.5) return 1; // 中环居民建筑
        return 2;              // 外环保底小屋
    }

    function buildFactoryBlock(cx, cz) {
        // 由于现在的厂房是占用 2x2 甚至 3x3 街区的巨型建筑
        // 我们利用坐标的奇偶性，强行挖空相邻街区，仅在 "偶数格" 允许起大型厂房，防止穿模堆栈
        const gridX = Math.round(cx / CELL);
        const gridZ = Math.round(cz / CELL);
        if (Math.abs(gridX) % 2 === 0 || Math.abs(gridZ) % 2 === 0) return;

        const pal = BPALS[5]; // 改用全新的红砖/铁锈红色系调色板
        const rk = 'r4'; // 保持深色屋顶
        const cnt = 1; // 单体巨兽
        for (let n = 0; n < cnt; n++) {
            // 适度缩小主体面积，防止填满网格后边缘重叠，改为 1.3 ~ 1.9 倍边长
            const bw = R(BS * 1.3, BS * 1.9);
            const bd = R(BS * 1.3, BS * 1.9);
            const bh = R(2.5, 4.5);
            // 稍作微调，往区块中心靠，偏移范围也减小
            const ox = R(-BS / 5, BS / 5), oz = R(-BS / 5, BS / 5);
            const px = cx + ox, pz = cz + oz;
            const bc = rp(pal);
            const bg = new THREE.BoxGeometry(bw, bh, bd, 1, 1, 1);
            jitter(bg, 0.02);
            bg.translate(px, bh / 2, pz);
            col(`b${bc}`, bg); // 发送给底层红木材质组

            // ================= 屋顶 =================
            const rg = new THREE.BoxGeometry(bw + 0.1, 0.2, bd + 0.1, 1, 1, 1);
            rg.translate(px, bh + 0.1, pz);
            col(rk, rg);

            // ================= 标志物排布 =================
            const rand = Math.random();
            // > 60% 会拥有一个非常高耸的大烟囱
            if (rand > 0.4) {
                const ch = R(6, 12);
                const cg = new THREE.CylinderGeometry(0.3, 0.6, ch, 8);
                cg.translate(px + bw / 3, bh + ch / 2, pz - bd / 3);
                col('pole', cg);
                // 给大烟囱顶上套一个会亮红光的防撞警告灯
                const wl = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                wl.translate(px + bw / 3, bh + ch + 0.1, pz - bd / 3);
                col('warnLight', wl);
            }

            // ================= 巨型异形结构 (储气罐等) =================
            if (Math.random() > 0.3) {
                // 在厂房的另一角加一个巨型球罐或柱形罐
                const r = R(1.2, 2.0); // 罐子的半径
                const ty = Math.random() > 0.5; // 是圆柱形还是球形

                const cX = px - bw / 3;
                const cZ = pz + bd / 3;

                if (ty) {
                    // 圆柱储水塔
                    const h = R(4, 7);
                    const tank = new THREE.CylinderGeometry(r, r, h, 12);
                    tank.translate(cX, h / 2, cZ);
                    col('ant', tank); // 用银白色金属
                } else {
                    // 高压球罐储气点
                    const baseH = R(1, 2);
                    const sphere = new THREE.SphereGeometry(r, 12, 10);
                    sphere.translate(cX, baseH + r, cZ);
                    col('ant', sphere);

                    // 补充四根细柱子做基座
                    const leg = new THREE.CylinderGeometry(0.1, 0.1, baseH + r * 0.5, 4);
                    leg.translate(cX, (baseH + r * 0.5) / 2, cZ);
                    col('pole', leg);
                }
            }

            // 发光窗户
            if (bh > 2) {
                const wG = new THREE.PlaneGeometry(bw * 0.6, 0.4);
                wG.translate(px, bh / 2, pz + bd / 2 + 0.01);
                col('win', wG);
            }
            totalB++;
        }
    }

    // 主函数，向世界某块中心 (cx,cz) 提供批量盖起多幢大楼的能力 (在中心稍微位置偏移防止互相粘连）
    function buildBlock(cx, cz, zone) {
        if (zone === 4) return buildFactoryBlock(cx, cz);
        const pal = BPALS[zone]; // 提取出本区的合法颜色板
        const rk = `r${zone}`; // 根据区号拿出独属屋顶色环 ID

        const dc = Math.hypot(cx / CELL, cz / CELL); // 用原点曼哈顿偏移计算大致距离
        const cnt = zone === 0 ? RI(1, 4) : zone === 3 ? RI(1, 3) : RI(1, 2); // 越往城外，一个街区里面的房子修的越少
        for (let n = 0; n < cnt; n++) {
            const bw = R(0.8, BS * 0.72); // 随机一栋楼的 X 轴宽带 
            const bd = R(0.8, BS * 0.72); // Z 轴进深
            let bh = zone === 0 ? R(5, 28) : zone === 3 ? R(3, 12) : zone === 1 ? R(2, 8) : R(2, 6);
            if (zone === 0) bh *= Math.max(0.5, 1.8 - dc * 0.12); // cbd最中心的那些特别的冲天而起拔高

            const ox = R(-BS / 2 + bw / 2, BS / 2 - bw / 2), oz = R(-BS / 2 + bd / 2, BS / 2 - bd / 2); // 防建筑重叠的区域平移
            const px = cx + ox, pz = cz + oz;
            const bc = rp(pal); // 抓色
            // ---- 主体房屋 ----
            const bg = new THREE.BoxGeometry(bw, bh, bd, 1, 1, 1);
            jitter(bg, 0.04);
            bg.translate(px, bh / 2, pz);
            col(`b${bc}`, bg);
            // ---- 房顶盖帽 ----
            const rh = bh > 10 ? R(0.4, 1.4) : 0.2; // 如果是高楼则带厚顶盘，反则薄薄的屋顶瓦片
            const rg = new THREE.BoxGeometry(bw + 0.1, rh, bd + 0.1, 1, 1, 1);
            jitter(rg, 0.04);
            rg.translate(px, bh + rh / 2, pz);
            col(rk, rg);
            // ---- 如果超高层随机加盖避雷针杆子等异构设施 ----
            if (bh > 14 && Math.random() > 0.4) {
                const ah = R(1.5, 4);
                const ag = new THREE.CylinderGeometry(0.04, 0.04, ah, 4);
                ag.translate(px, bh + rh + ah / 2, pz);
                col('ant', ag);
            }
            // ---- 大楼加装发光窗户方块 (做灯红酒绿使用) ---- 
            if (bh > 4) {
                const fl = Math.floor(bh / 2), wr = Math.max(1, Math.floor(bw / 1.2));
                for (let f = 1; f <= fl; f++) {
                    for (let w = 0; w < wr; w++) {
                        // 并不是每个窗户都会亮灯。晚上熄灯不整齐的样子最逼真。
                        if (Math.random() > 0.5) continue;
                        const xo = -bw / 2 + (w + 0.5) * (bw / wr), wy = f * 2 - 0.5;
                        // 南北朝向打平窗贴图进行贴紧墙壁
                        let gF = new THREE.PlaneGeometry(0.5, 0.7);
                        gF.translate(px + xo, wy, pz + bd / 2 + 0.01);
                        col('win', gF);
                        let gB = new THREE.PlaneGeometry(0.5, 0.7);
                        gB.rotateY(Math.PI);
                        gB.translate(px + xo, wy, pz - bd / 2 - 0.01);
                        col('win', gB);
                    }
                }
            }
            totalB++; // 每建造完成一栋，计数器跟进
        }
    }

    // -- 主题游乐公园绿地地块基建 --
    const pkCX = (PK_MIN + PK_MAX) / 2 * CELL + CELL / 2;
    const pkCZ = (PK_MIN + PK_MAX) / 2 * CELL + CELL / 2;
    // 将整个公园覆盖满翠绿平地
    {
        const pg = new THREE.BoxGeometry((PK_MAX - PK_MIN + 1) * CELL, 0.15, (PK_MAX - PK_MIN + 1) * CELL);
        pg.translate(pkCX, 0.06, pkCZ);
        col('parkG', pg);
    }

    // 【主地图迭代建设者】 扫过地皮开始铺设每个区的规划开发
    for (let i = -HG; i < HG; i++) {
        for (let j = -HG; j < HG; j++) {
            // 保留一点 8% 纯留白的地皮
            if (Math.random() < 0.08) continue;
            // 如果撞见划给政府公园用的地皮直接跳过
            if (isPark(i, j)) continue;
            const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
            // 绕开水域或者池塘
            if (inLakeZone(cx, cz)) continue;
            // 一切顺利，进行开发高楼
            buildBlock(cx, cz, zoneOf(i + 0.5, j + 0.5));
        }
        prog(0.16 + 0.42 * ((i + HG) / GRID)); // 提供加载的百分比交互动画
    }
    prog(0.58);

    // --- 6. 城市绿化植树阶段 ---
    function cTree(x, z, sc = 1) {
        // 创建圆柱树桩
        const h = R(1.4, 3.2) * sc, rv = R(0.5, 1.1) * sc, tH = h * 0.4;
        const tg = new THREE.CylinderGeometry(0.12, 0.18, tH, 5);
        tg.translate(x, tH / 2, z);
        col('trunk', tg);
        // 双重三角拼接作为浓密针叶植被
        for (let k = 0; k < 2; k++) {
            const lH = h * (0.55 - k * 0.1);
            const cg = new THREE.ConeGeometry(rv * (1 - k * 0.25), lH, 6);
            jitter(cg, 0.06);
            cg.translate(x, tH + k * h * 0.28 + lH / 2, z);
            col(`lf${Math.floor(Math.random() * 5)}`, cg);
        }
        totalT++;
    }
    // 城市场区见缝扎树
    for (let i = -HG; i < HG; i++) {
        for (let j = -HG; j < HG; j++) {
            if (isPark(i, j) || Math.random() < 0.6) continue;
            const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
            if (inLakeZone(cx, cz)) continue;
            // 分别种在某个院子的左上和右上缝隙角落
            for (const [dx, dz] of [[BS / 2 - 0.3, BS / 2 - 0.3], [-BS / 2 + 0.3, BS / 2 - 0.3]]) {
                if (Math.random() < 0.4) cTree(cx + dx, cz + dz);
            }
        }
    }
    // 在公园里面也种出环绕绿化林
    for (let t = 0; t < 18; t++) {
        const a = R(0, Math.PI * 2), d = R(10, (PK_MAX - PK_MIN) * CELL / 2 - 0.5);
        cTree(pkCX + Math.cos(a) * d, pkCZ + Math.sin(a) * d, R(0.9, 1.5));
    }
    // ---- 针对湖泊周围重点绿化 ----
    LAKES.forEach(l => {
        // 根据湖泊的大小决定种树的数量 (大约 15 到 30 棵)
        const density = Math.floor((l.rx + l.rz) * 1.5);
        for (let k = 0; k < density; k++) {
            const angle = R(0, Math.PI * 2);
            // 将树种散布在湖边外围 1.2倍 到 1.8倍 半径的一圈内
            const distScale = R(1.2, 1.8);
            const tx = l.wx + Math.cos(angle) * (l.rx * distScale);
            const tz = l.wz + Math.sin(angle) * (l.rz * distScale);
            // 沿湖生长的树通常比较茂盛但不一定太高
            cTree(tx, tz, R(0.8, 1.4));
        }
    });
    // 海滩外围再补上矮化椰子绿丛
    for (let i = 0; i < 20; i++) {
        cTree(R(-HALF + 5, HALF - 5), R(-(HALF + 3), -(HALF + 20)), 0.8);
    }

    // --- 7. 安装路灯设施光效 ---
    for (let i = -HG; i <= HG; i++) {
        for (let j = -HG; j <= HG; j++) {
            const x = i * CELL, z = j * CELL;
            if (inLakeZone(x, z)) continue; // 不在湖中心装路灯
            for (const [dx, dz] of [[0.9, 0.9], [-0.9, 0.9]]) {
                const pg = new THREE.CylinderGeometry(0.05, 0.05, 3, 4);
                pg.translate(x + dx, 1.5, z + dz);
                col('pole', pg);
                const hg = new THREE.SphereGeometry(0.2, 4, 3);
                hg.translate(x + dx, 3.15, z + dz);
                col('lamp', hg); // 发光的灯泡小网格
            }
        }
    }
    prog(0.68);

    // --- 8. 丰富公园活动小摊搭建帐篷 ---
    function cTent(x, z, sc = 1) {
        const bR = R(1.2, 2) * sc, bH = 0.4 * sc;
        const bg = new THREE.CylinderGeometry(bR, bR, bH, 8);
        bg.translate(x, bH / 2, z);
        col(rp(TK), bg);
        const cH = R(2.5, 4) * sc;
        const cg = new THREE.ConeGeometry(bR * 1.15, cH, 8);
        jitter(cg, 0.08);
        cg.translate(x, bH + cH / 2, z);
        col(rp(TK), cg);
        const fg = new THREE.ConeGeometry(0.12, 0.5, 4);
        fg.translate(x, bH + cH + 0.45, z);
        col(rp(TK), fg);
    }
    const tentOffs = [[-14, 6], [-8, 14], [2, 18], [16, 10], [18, -2], [12, -14], [-2, -16], [-14, -8], [-18, 0], [0, 4], [8, 8], [-6, -6], [14, -10], [-10, 10]];
    tentOffs.forEach(([dx, dz]) => {
        if (Math.abs(dx) < 8 && Math.abs(dz) < 8) return;
        cTent(pkCX + dx, pkCZ + dz, R(0.8, 1.3));
    });

    // --- 9. 开始最终的网格数据执行 Flush 操作 ---
    // 以上都是组装蓝图，这一步把前面的那些路灯、建筑、大树真正的拼成一个 3D 优化大结构缓存对象
    const staticGroup = flush(true, true);
    scene.add(staticGroup);

    // 当前版本所有静态几何都在同一个合批组里，保留 parkSG/cityGroup 兼容旧字段。
    const parkSG = new THREE.Group();
    const cityGroup = staticGroup;

    prog(0.76);

    // 导出公园区域和城市建筑层，供获取数量统计和资源追踪。
    exportMeshReference('parkSG', parkSG);
    exportMeshReference('cityGroup', cityGroup);
    exportMeshReference('staticGroup', staticGroup);

    return {
        totalB,
        pkCX,
        pkCZ,
        lakeMeshes: lakeMeshes,
        staticGroup,
        cityGroup,
        parkSG
    };
}

// ==========================================
// 辅助导出存储管理
// ==========================================
const refs = {};
export function exportMeshReference(key, obj) { refs[key] = obj; }
export function getMeshReference(key) { return refs[key]; }
