import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GRID, CELL, HALF, HG, PK_MIN, PK_MAX, LAKES, inLakeZone } from './config.js';
import { R, RI, rp, jitter } from './utils.js';
import { getMat, VCOLS, pedBodyMats, pedHairMats } from './materials.js';

// ==========================================
// 动态模型系统：游乐设施、汽车、NPC行人 (entities.js)
// ==========================================

export const animObjs = [];    // 记录公园区域可以自公转旋转的设施
export const pedestrians = []; // 在城市漫步的小绿人

const NUM_VEHICLES = 60; // 同屏生成的汽车总数上限
const NUM_PEDS = 80;     // 上路游向的行人总数量

/**
 * 组装一台旋转木马设施 (Carousel)
 * @param {THREE.Scene} scene 我们要放入的那个顶层场景节点对象
 * @param {number} x 世界横向坐标
 * @param {number} z 世界纵深坐标
 */
export function buildCarousel(scene, x, z) {
    const root = new THREE.Group();
    root.position.set(x, 0, z); // 对齐公园基地

    // 木马的核心自转轴组
    const spin = new THREE.Group();

    // 底座 (静态不动，提供着地点)
    {
        const pg = new THREE.CylinderGeometry(2.8, 2.8, 0.3, 16);
        const base = new THREE.Mesh(pg, getMat('merryBase'));
        base.position.y = 0.15;
        base.castShadow = true;
        root.add(base);
    }

    // 旋转木马的天花板罩子
    {
        const cg = new THREE.ConeGeometry(3.5, 1.8, 16);
        jitter(cg, 0.05); // 将罩子捏出不规则的小低面角
        const c = new THREE.Mesh(cg, getMat('merryTop'));
        c.position.y = 4.5;
        spin.add(c);
    }

    // 支撑罩子的中心柱头
    {
        const pg = new THREE.CylinderGeometry(0.12, 0.12, 5, 6);
        const p = new THREE.Mesh(pg, getMat('ant'));
        p.position.y = 2.5;
        spin.add(p);
    }

    // 生成周围的 8 个小木马乘坐座位，围绕柱子旋转分布 
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const hg = new THREE.BoxGeometry(0.4, 0.6, 0.25);
        const h = new THREE.Mesh(hg, getMat(`gon${k}`));
        // 高度上下错开摆放
        h.position.set(Math.sin(a) * 2.4, R(1.5, 3.5), Math.cos(a) * 2.4);
        spin.add(h); // 接在这个挂件容器里
        // 每个座位接一根悬挂吊杆
        const sg = new THREE.CylinderGeometry(0.02, 0.02, R(0.8, 1.5), 4);
        const s = new THREE.Mesh(sg, getMat('ant'));
        s.position.copy(h.position);
        s.position.y += 0.8;
        spin.add(s);
    }
    root.add(spin);
    scene.add(root);

    // 注册入游乐设施的动画维护队列 (绕着自身的 Y 轴，也就是水平打转)
    animObjs.push({ obj: spin, axis: 'y', spd: 0.012 });
}

/**
 * 拼装摩天轮 (Ferris) 
 * @param {THREE.Scene} scene 三维主场景
 * @param {number} px 中心落脚点 X
 * @param {number} pz 中心落脚点 Z
 */
export function buildFerris(scene, px, pz) {
    const RAD = 8, CY = 10, N = 12; // 摩天轮的轮切面半径和轮毂数量设定
    const root = new THREE.Group();
    root.position.set(px, 0, pz);
    const legM = getMat('fLeg'); // A型支架灰色腿质材质

    // -- 单立柱式支撑结构 --
    // 底部水泥座
    const bb = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.8, 3.0), legM);
    bb.position.set(0, 0.4, 0);
    root.add(bb);

    // 单根中心主轴支柱
    const pg = new THREE.CylinderGeometry(0.4, 0.8, CY + 1, 8);
    const pole = new THREE.Mesh(pg, legM);
    pole.position.set(0, (CY + 1) / 2, -0.4); // 略微后靠托举
    pole.castShadow = true;
    root.add(pole);

    // 主承轴
    const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 8), legM);
    ax.position.set(0, CY, 0);
    ax.rotation.x = Math.PI / 2;
    root.add(ax);

    // -- 中心转圈的轮盘构架 --
    const spin = new THREE.Group();
    spin.position.set(0, CY, 0);

    // 圆环，摩天轮的外钢架轮廓（由于自带 XY 完美贴合，直接以 Z 来转动即可）
    const ringG = new THREE.TorusGeometry(RAD, 0.25, 8, 36);
    const ring = new THREE.Mesh(ringG, getMat('fWheel'));
    ring.castShadow = true;
    spin.add(ring);

    // 里侧的一道花哨小装饰环
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(RAD * 0.5, 0.14, 6, 20), getMat('fWheel'));
    spin.add(ring2);

    // 为摩天轮挂上乘坐着的小座舱
    for (let k = 0; k < N; k++) {
        const theta = (k / N) * Math.PI * 2;
        // 把连接钢棒 (Spoke) 对着从内向外插向轮圈
        const sG = new THREE.CylinderGeometry(0.06, 0.06, RAD, 4);
        const spoke = new THREE.Mesh(sG, getMat('fSpoke'));
        spoke.position.set(Math.cos(theta) * RAD / 2, Math.sin(theta) * RAD / 2, 0);
        spoke.rotation.z = theta - Math.PI / 2; // 让管道的方向正对应法向量
        spoke.castShadow = true;
        spin.add(spoke);

        // 圆边末端挂上小小的带窗舱室
        const gx = Math.cos(theta) * RAD, gy = Math.sin(theta) * RAD;
        const gon = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.5), getMat(`gon${k % 8}`));
        gon.position.set(gx, gy, 0);
        gon.castShadow = true;
        spin.add(gon);

        // 每个仓室加上发光的玻璃板
        const wg = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.25), getMat('win'));
        wg.position.set(gx, gy, 0.26);
        spin.add(wg);
    }
    root.add(spin);
    scene.add(root);

    // 注入摩天轮更新动画列队 (绕着自身的 Z 轴公转运动)
    animObjs.push({ obj: spin, axis: 'z', spd: 0.004 });
}

// -------------------------------------------------------------
// 车辆 InstancedMesh 方案：基础小车按同材质组件拆分并实例化，兼顾性能与可维护性
// -------------------------------------------------------------

let carTemplateMats = [];
let carTemplateGeometries = [];

function buildCarTemplateGeometries() {
    // 组件 0: 车漆 (主体和顶棚合并)
    const bodyG = new THREE.BoxGeometry(1.6, 0.6, 0.9); jitter(bodyG, 0.02); bodyG.translate(0, 0.45, 0);
    const cabG = new THREE.BoxGeometry(0.9, 0.45, 0.75); cabG.translate(-0.1, 0.9, 0);
    carTemplateGeometries.push(mergeGeometries([bodyG, cabG]));
    carTemplateMats.push(null); // 色漆待定

    // 组件 1: 玻璃窗
    const wg1 = new THREE.PlaneGeometry(0.3, 0.3); wg1.translate(-0.1, 0.9, 0.38);
    const wg2 = new THREE.PlaneGeometry(0.3, 0.3); wg2.rotateY(Math.PI); wg2.translate(-0.1, 0.9, -0.38);
    carTemplateGeometries.push(mergeGeometries([wg1, wg2]));
    carTemplateMats.push(getMat('win'));

    // 组件 2: 轮胎
    const wheels = [];
    for (const [wx, wz] of [[-0.5, 0.48], [0.5, 0.48], [-0.5, -0.48], [0.5, -0.48]]) {
        const whg = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 6);
        whg.rotateX(Math.PI / 2); whg.translate(wx, 0.15, wz);
        wheels.push(whg);
    }
    carTemplateGeometries.push(mergeGeometries(wheels));
    carTemplateMats.push(getMat('vWheel'));

    // 组件 3: 车灯
    const lights = [];
    for (const dz of [0.3, -0.3]) {
        const hl = new THREE.SphereGeometry(0.06, 4, 3); hl.translate(0.82, 0.5, dz);
        lights.push(hl);
    }
    carTemplateGeometries.push(mergeGeometries(lights));
    carTemplateMats.push(getMat('headlight'));
}

export const instancedCarGroups = []; // 保存各个实例化组件数组的引用，用作暴露给外部刷新位移。
export const carInstancesData = [];   // 保存每一辆抽象的"逻辑车"的状态(位置、速度等)
export const vehicles = carInstancesData; // 兼容旧字段：车辆数量与实例化数据保持一致

function initInstancedVehicles(scene) {
    if (carTemplateGeometries.length === 0) buildCarTemplateGeometries();

    // 根据那 8 种可能的车身配漆颜色创建分组的 InstanceMesh
    // 并且我们一共需要创建 NUM_VEHICLES 辆，这里平摊名额。
    const countsPerColor = Array.from({ length: VCOLS.length }, () => 0);

    // 初始化逻辑数据
    for (let i = 0; i < NUM_VEHICLES; i++) {
        const colorIdx = RI(0, VCOLS.length - 1);
        const isHoriz = Math.random() > 0.5;
        let pos, dir;
        do {
            if (isHoriz) {
                const roadIdx = RI(-HG, HG);
                const z = -HALF + ((roadIdx + HG) % GRID) * CELL;
                pos = new THREE.Vector3(R(-HALF, HALF), 0.01, z + (Math.random() > 0.5 ? 0.4 : -0.4));
                dir = Math.random() > 0.5 ? 1 : -1;
            } else {
                const roadIdx = RI(-HG, HG);
                const x = -HALF + ((roadIdx + HG) % GRID) * CELL;
                pos = new THREE.Vector3(x + (Math.random() > 0.5 ? 0.4 : -0.4), 0.01, R(-HALF, HALF));
                dir = Math.random() > 0.5 ? 1 : -1;
            }
        } while (inLakeZone(pos.x, pos.z));

        const rotY = (isHoriz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));

        carInstancesData.push({
            colorIdx,
            localArrayIdx: countsPerColor[colorIdx], // 分配在这批同色车里的内部排序号
            pos,
            rotY,
            isHoriz,
            dir,
            speed: R(0.02, 0.06)
        });
        countsPerColor[colorIdx]++;
    }

    // 正式为每一种漆色生产 InstancedMeshs 组
    for (let ci = 0; ci < VCOLS.length; ci++) {
        const numThisColor = countsPerColor[ci];
        if (numThisColor === 0) continue;

        const matBody = getMat(`v${ci}`);

        // 对于车身，车窗，轮胎，车灯的 4 个 Mesh 模块各创一个实例化版本。
        const instGroup = {
            body: new THREE.InstancedMesh(carTemplateGeometries[0], matBody, numThisColor),
            win: new THREE.InstancedMesh(carTemplateGeometries[1], carTemplateMats[1], numThisColor),
            wheel: new THREE.InstancedMesh(carTemplateGeometries[2], carTemplateMats[2], numThisColor),
            light: new THREE.InstancedMesh(carTemplateGeometries[3], carTemplateMats[3], numThisColor)
        };

        instGroup.body.castShadow = true;

        scene.add(instGroup.body);
        scene.add(instGroup.win);
        scene.add(instGroup.wheel);
        scene.add(instGroup.light);

        instancedCarGroups[ci] = instGroup;
    }
}

/**
 * 外部循环每一帧调用该驱动，用来刷新每一辆车的底层矩阵
 */
export function updateInstancedVehicles() {
    const dummy = new THREE.Object3D();

    // 遍历所有逻辑车辆并更新坐标
    for (const v of carInstancesData) {
        if (v.isHoriz) {
            v.pos.x += v.dir * v.speed;
            if (v.pos.x > HALF + 10) v.pos.x = -HALF - 10;
            if (v.pos.x < -HALF - 10) v.pos.x = HALF + 10;
        } else {
            v.pos.z += v.dir * v.speed;
            if (v.pos.z > HALF + 10) v.pos.z = -HALF - 10;
            if (v.pos.z < -HALF - 10) v.pos.z = HALF + 10;
        }

        // 把逻辑位置转入 dummy object 来获得正确的 Matrix4 黑盒计算
        dummy.position.copy(v.pos);
        dummy.rotation.set(0, v.rotY, 0);

        // 缩到地底等于隐身
        if (inLakeZone(v.pos.x, v.pos.z)) {
            dummy.scale.set(0, 0, 0);
        } else {
            dummy.scale.set(1, 1, 1);
        }

        dummy.updateMatrix();

        // 将最新计算好的矩阵刷入真实在舞台展示出来的这个特定的实例身上
        const group = instancedCarGroups[v.colorIdx];
        if (group) {
            group.body.setMatrixAt(v.localArrayIdx, dummy.matrix);
            group.win.setMatrixAt(v.localArrayIdx, dummy.matrix);
            group.wheel.setMatrixAt(v.localArrayIdx, dummy.matrix);
            group.light.setMatrixAt(v.localArrayIdx, dummy.matrix);
        }
    }

    // 通知底层需要把大批量的 Buffer 数据翻新上传给显存芯片
    for (const gi in instancedCarGroups) {
        const group = instancedCarGroups[gi];
        if (group) {
            group.body.instanceMatrix.needsUpdate = true;
            group.win.instanceMatrix.needsUpdate = true;
            group.wheel.instanceMatrix.needsUpdate = true;
            group.light.instanceMatrix.needsUpdate = true;
        }
    }
}

/**
 * 组装单个城市像素行人 (仍然保留单个 Group)
 */
function createPed() {
    const g = new THREE.Group();
    const bk = rp(pedBodyMats); // 从短袖池子里抽衣服色
    // 躯干部位
    const bodyG = new THREE.BoxGeometry(0.22, 0.45, 0.18);
    const body = new THREE.Mesh(bodyG, getMat(bk));
    body.position.y = 0.6;
    g.add(body);
    // 粉嘟圆圆的脑袋
    const headG = new THREE.SphereGeometry(0.12, 5, 4);
    const head = new THREE.Mesh(headG, getMat('pSkin'));
    head.position.y = 0.95;
    g.add(head);
    // 戴一层刺头假发套上去
    const hairG = new THREE.SphereGeometry(0.13, 5, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    const hair = new THREE.Mesh(hairG, getMat(rp(pedHairMats)));
    hair.position.y = 0.97;
    g.add(hair);
    // 两条木头站立马赛克短腿
    for (const dz of [0.05, -0.05]) {
        const lg = new THREE.BoxGeometry(0.1, 0.35, 0.1);
        const leg = new THREE.Mesh(lg, getMat(bk));
        leg.position.set(0, 0.2, dz);
        g.add(leg);
    }
    return g;
}

/**
 * 批量将这些动态小零件全部按一定逻辑生成在三维世界的场景道路上
 * @param {THREE.Scene} scene - 主舞台场景
 * @param {Object} parkPos - 之前算好回传的公园坐标对象中心点
 */
export function populateEntities(scene, parkPos) {
    // 1. 生成公园主题设备
    buildCarousel(scene, parkPos.pkCX - 12, parkPos.pkCZ + 8);
    buildCarousel(scene, parkPos.pkCX + 14, parkPos.pkCZ - 10);
    buildFerris(scene, parkPos.pkCX, parkPos.pkCZ);
    buildFerris(scene, parkPos.pkCX - 18, parkPos.pkCZ + 14);

    // 2. 批量将载具数据初始化
    initInstancedVehicles(scene);

    // 3. 生成悠哉游哉的方块行人 (成群结队且聚集在热点地区)
    let pedsCreated = 0;
    while (pedsCreated < NUM_PEDS) {
        // 让行人不再是单兵作战，而是 2 到 4 人一组的小集体
        const groupSize = Math.min(RI(2, 4), NUM_PEDS - pedsCreated);
        const isHoriz = Math.random() > 0.5;
        const dir = Math.random() > 0.5 ? 1 : -1; // 全组人走同一个方向
        const groupSpeed = R(0.005, 0.015); // 全组人的基准速度要统一，避免很快走散
        const basePos = new THREE.Vector3();

        // 强行增加热点区域的几率 (60% 概率会直接投放到湖边或公园附近)
        const isHotspot = Math.random() < 0.6;
        if (isHotspot) {
            if (Math.random() < 0.5) {
                // 投放在游乐场区域内随机点
                const cx = (PK_MIN + PK_MAX) / 2 * CELL + CELL / 2;
                const cz = (PK_MIN + PK_MAX) / 2 * CELL + CELL / 2;
                const radius = R(2, 16);
                const a = R(0, Math.PI * 2);
                basePos.set(cx + Math.cos(a) * radius, 0.01, cz + Math.sin(a) * radius);
            } else {
                // 沿着现存的湖泊周边投放
                const lk = rp(LAKES);
                const ang = R(0, Math.PI * 2);
                const dist = R(1.3, 2.5); // 沿水岸散步
                basePos.set(lk.wx + Math.cos(ang) * lk.rx * dist, 0.01, lk.wz + Math.sin(ang) * lk.rz * dist);
            }
        } else {
            // 传统的随机马路牙子投放
            const roadIdx = RI(-HG, HG);
            if (isHoriz) {
                const z = -HALF + ((roadIdx + HG) % GRID) * CELL + (Math.random() > 0.5 ? 2 : -2);
                basePos.set(R(-HALF, HALF), 0.01, z);
            } else {
                const x = -HALF + ((roadIdx + HG) % GRID) * CELL + (Math.random() > 0.5 ? 2 : -2);
                basePos.set(x, 0.01, R(-HALF, HALF));
            }

            // 传统随机依然需要避水
            if (inLakeZone(basePos.x, basePos.z)) continue;
        }

        // 以选择的基准点为中心，散布同组的几个熟人
        for (let i = 0; i < groupSize && pedsCreated < NUM_PEDS; i++) {
            const ped = createPed();
            // 在基本坐标上各自有一点细微的结伴错开距离
            const ox = basePos.x + R(-1.2, 1.2);
            const oz = basePos.z + R(-1.2, 1.2);
            // 简单防溺水（热点区域允许更靠近湖边）
            if (inLakeZone(ox, oz) && !isHotspot) continue;

            const finalPos = new THREE.Vector3(ox, 0.01, oz);
            ped.rotation.y = (isHoriz ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
            ped.position.copy(finalPos);
            scene.add(ped);

            // 让每个人的速度有极其微弱的差异，走出错落有致的随性步态
            pedestrians.push({ mesh: ped, isHoriz, dir, speed: groupSpeed + R(-0.001, 0.001) });
            pedsCreated++;
        }
    }
}
