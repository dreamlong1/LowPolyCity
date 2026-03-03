import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { PAL, HALF, GRID, inLakeZone } from './config.js';
import { prog } from './utils.js';
import { initMaterials, getMat, waterMat } from './materials.js';
import { buildStaticWorld, getMeshReference, lakeMeshes } from './world.js';
import { populateEntities, animObjs, pedestrians, updateInstancedVehicles, instancedCarGroups } from './entities.js';

let renderer, scene, camera, controls;
let ambL, sunL, hemiL; // 环境光，直射日光，和天际天空光

window.currentTOD = 'day'; // 新增全局变量记录当前昼夜状态供大屏读取

/**
 * 整个程序的切入点 (入口)
 */
function init() {
    // 实例化主渲染器 (强制允许透明背景，并保留缓冲区以防和上层 ECharts 画布在合成时起冲突)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0px';
    renderer.domElement.style.zIndex = '1'; // 确保处于底层
    renderer.shadowMap.enabled = true; // 打开投影能力开关
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 偏向较柔的软阴影边缘
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // 开启电影胶片级别的广色域自动曝光映射计算
    renderer.toneMappingExposure = 1.15; // 设置过曝明亮基准度
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    // 由于拉远了全景视角，之前的指数雾如果在远距离会显得极其浓郁，导致城市看起来灰蒙蒙，所以需要大幅稀释雾气浓度
    scene.fog = new THREE.FogExp2(0x0a1628, 0.0035);

    // 透视照相机安置
    camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 2000);
    // 固化用户手工选择的最佳机位视角
    camera.position.set(0, 110, -120);
    camera.lookAt(0, 0, 0);

    // 标准相机轨控插件
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0); // 让控制器也聚焦于原点，避免镜头跑偏
    controls.enableDamping = true; // 打开缓动顺滑效果
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05; // 限制不能钻到低趴地幔的地底下去看天
    controls.minDistance = 20;  // 可以推脸查看的最逼近距离
    controls.maxDistance = 260; // 滚轮向后能拉远看大全景的最高天空天花板

    // 提前准备所有颜色涂料（装载字典完毕）
    initMaterials();

    renderer.setClearColor(PAL.day.sky); // 以昼日清空画布基准色为主

    // =========== 1. 灯光系统架子铺设 ==========
    // 环境基底全局光照
    ambL = new THREE.AmbientLight(PAL.day.ambC, PAL.day.ambI);
    scene.add(ambL);

    // 主太阳光源（充当全方位能产生重磅硬阴影的灯光设备）
    sunL = new THREE.DirectionalLight(0xffffff, 2.0);
    sunL.position.set(80, 120, 60);
    sunL.castShadow = true;
    Object.assign(sunL.shadow.mapSize, { width: 1024, height: 1024 }); // 提档阴影位图分辨率精度
    // 放宽相机的捕猎渲染四边形视野体范围，确保全城区建筑都囊括在这个相机的投射边界以内。
    sunL.shadow.camera.left = sunL.shadow.camera.bottom = -150;
    sunL.shadow.camera.right = sunL.shadow.camera.top = 150;
    sunL.shadow.camera.near = 1;
    sunL.shadow.camera.far = 500;
    scene.add(sunL);

    // 天空大地渐变环境散射补充光（给低模暗部填充一种蓝色/暗色折射调，打破死板的纯黑阴影死角）
    hemiL = new THREE.HemisphereLight(0x87ceeb, 0x3d7a3d, 0.6);
    scene.add(hemiL);

    // =========== 2. 生成世界地理图景 ==========
    const worldData = buildStaticWorld(scene);

    // =========== 3. 分发公园和道路上的NPC和载体 ==========
    populateEntities(scene, worldData);

    // 进度条结束
    prog(0.88);

    // =========== 4. 统计前端信息面板 (为了防崩溃加问号链) ==========
    if (document.getElementById('sB')) document.getElementById('sB').textContent = worldData.totalB;
    if (document.getElementById('sG')) document.getElementById('sG').textContent = `${GRID}×${GRID}`;
    // 粗略算一下到底用到了多少次独立的 WebGL DrawCall （非常少了，基本实现了优化合并极大压缩）
    const staticDrawCalls = worldData.staticGroup
        ? worldData.staticGroup.children.length
        : worldData.cityGroup.children.length + worldData.parkSG.children.length;
    const vehicleDrawCalls = instancedCarGroups.filter(Boolean).length * 4;
    const dcEst = staticDrawCalls +
        4 + lakeMeshes.length +
        vehicleDrawCalls +
        pedestrians.length * 5;
    if (document.getElementById('sDC')) document.getElementById('sDC').textContent = `~${dcEst}`;

    prog(1);

    // 收尾 Loading 清除大黑幕
    setTimeout(() => {
        const el = document.getElementById('loading');
        if (el) {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 600);
        }
    }, 200);

    // 默认执行一次白天主题切换
    window.setTOD('day');

    // 设定 UI 绑定映射事件以及开启刷新循环
    bindUIEvents();
    animate();

    // ==================================
    // 最后异步地通知完全解耦的 DataScreen 发起渲染拦截操作
    // ==================================
    setTimeout(() => {
        window.onWorldDataReady?.(worldData, scene, renderer); // 传入 renderer 以供大屏读取底层性能数据
    }, 100);
}

/**
 * 设置整个城市的昼夜时辰光效主题
 * 会根据主题名称调动调色板切换整体的环境系统
 */
const TN = { day: '白天', dusk: '黄昏', night: '夜晚' };
window.setTOD = function (mode) {
    window.currentTOD = mode; // 记录最新状态
    const p = PAL[mode];
    // 背景及远层大片浓雾颜色
    renderer.setClearColor(p.sky);
    scene.fog.color.set(p.fog);

    // 主弱室外光改变
    ambL.color.set(p.ambC);
    ambL.intensity = p.ambI;

    // 主太阳色改变及退去日光猛烈强度
    sunL.color.set(p.sunC);
    sunL.intensity = p.sunI;

    // 软暗部高亮冷暖色替换
    hemiL.color.set(p.hS);
    hemiL.groundColor.set(p.hG);

    // 把土地也刷回当前时间段该呈现的黑灰色或青绿色
    getMeshReference('groundMesh').material.color.set(p.hG);

    // --------- 发光建筑系统更改 ----------
    // 门庭若市窗户的起灯点亮
    getMat('win').emissiveIntensity = p.wEI;
    getMat('lamp').emissiveIntensity = p.lEI; // 路灯开启自发光泛光晕度
    getMat('headlight').emissiveIntensity = mode === 'night' ? 1.5 : 0.6; // 车头灯大开闪瞎前方道路

    // 海波光效重新根据白天的深蓝还是晚上的墨蓝刷漆重覆
    waterMat.color.set(p.wCol);
    waterMat.opacity = p.wA;
    lakeMeshes.forEach(lm => {
        lm.material.color.set(p.wCol);
        lm.material.opacity = p.wA;
    });

    // GUI 标签切换响应
    if (document.getElementById('sT')) document.getElementById('sT').textContent = TN[mode];
    ['Day', 'Dusk', 'Night'].forEach(t => {
        document.getElementById(`b${t}`)?.classList.toggle('active', t.toLowerCase() === mode);
    });
};

function bindUIEvents() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 供主循环调用的一只三维时钟实例
const clock = new THREE.Clock();

/**
 * 每一帧的递归重绘入口循环，处理海洋波动的位移，处理所有交通网络上的碰撞小车以及路人们的轨迹更新
 */
function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    controls.update();

    // 1. 转起游乐园的浪漫公转大摆锤
    animObjs.forEach(({ obj, axis, spd }) => {
        obj.rotation[axis] += spd;
    });

    // 2. 通过 InstancedMesh 系统内部刷新逻辑驱动几百台车位置
    updateInstancedVehicles();

    // 3. 让像素假人们进行魔性的走路（走动不仅需要横向 X 位移，还得有一个 Y 半轴的心惊肉跳上下弹簧颠簸效果，来反映人在跨步的状态）
    pedestrians.forEach((p, idx) => {
        const bob = Math.sin(t * 4 + idx) * 0.03; // 起伏颠颠
        if (p.isHoriz) {
            p.mesh.position.x += p.dir * p.speed;
            if (p.mesh.position.x > HALF + 5) p.mesh.position.x = -HALF - 5;
            if (p.mesh.position.x < -HALF - 5) p.mesh.position.x = HALF + 5;
        } else {
            p.mesh.position.z += p.dir * p.speed;
            if (p.mesh.position.z > HALF + 5) p.mesh.position.z = -HALF - 5;
            if (p.mesh.position.z < -HALF - 5) p.mesh.position.z = HALF + 5;
        }
        // y轴随着步伐颠簸模拟其正在生机勃勃地逛街。
        p.mesh.position.y = 0.01 + Math.abs(bob);
        // 如果走进了湖里，视觉上先隐身。过了湖再出现。
        p.mesh.visible = !inLakeZone(p.mesh.position.x, p.mesh.position.z);
    });

    // 这个镜头其实加了一个慢到难以察觉的呼吸起伏缓动，使得你看全局画面时有一种镜头在天上漂浮的感觉，而不是死定在这里。
    camera.position.y += Math.sin(t * 0.28) * 0.004;

    renderer.render(scene, camera);

    // 通知外界框架目前正在渲染中的消息以便其它框架进行帧绑定计算
    window.onWorldTick?.();
}

// 唤起应用的入口
init();
