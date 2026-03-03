// ==========================================
// 数据大屏启动内核 (dashboard.js)
// 完全解耦：依赖全局抛出事件获取 3D 核心对象与渲染器指标
// ==========================================
import * as echarts from 'echarts';

let ecIns = []; // 存储四个大图表实例
let worldDataRef = null;
let rendererRef = null;

// 图表实例引用缓存，为了后续 Tick 能动态更新它们
let chartPowerLine = null;
let chartPerformance = null;
let chartTraffic = null;

const timeData = [];
const powerData = [];

// 为性能池柱状图分配滑动数组
const perfTimeData = [];
const dcData = [];
const triData = [];

/**
 * 当 3D 引擎准备好所有的静态与初始动态数据时被回调触发
 * @param {Object} worldData - 从 world.js 构建出的城市原始数据对象
 * @param {THREE.Scene} scene - 主舞台场景
 * @param {THREE.WebGLRenderer} renderer - 主渲染器 (用于抓取 DrawCalls 和 面数)
 */
window.onWorldDataReady = function (worldData, scene, renderer) {
    console.log("[DataScreen] World data received. Initializing Dashboard...", worldData);
    worldDataRef = worldData;
    rendererRef = renderer;
    initCharts();
};

/**
 * 每帧引擎循环心跳 (来自 main.js animate)
 * 利用定时器节流来更新大屏数据，避免每帧都刷新 ECharts 导致卡顿
 */
let lastTickTime = 0;
window.onWorldTick = function () {
    const now = Date.now();
    if (now - lastTickTime > 1000) { // 每秒跳动一次图表
        lastTickTime = now;
        updateDynamicCharts();
    }
};

// ==============================================
// 1. 宏观侧沿面板：ECharts 实例化
// ==============================================
function initCharts() {
    const commonOpt = {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Segoe UI' },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(5, 12, 30, 0.8)',
            borderColor: '#7df9ff',
            textStyle: { color: '#fff', fontSize: 12 }
        }
    };

    // --- 左侧上方 (饼图)：城市用地规划结构 ---
    const cZoning = echarts.init(document.getElementById('c-zoning'), 'dark');
    // 根据生成的总建筑数量和模型大概估算比例
    const totalB = worldDataRef.totalB || 100;
    const lakes = worldDataRef.lakeMeshes ? worldDataRef.lakeMeshes.length : 0;

    // 我们假设 40% 是住宅，25% 是商业 CBD，20% 是工业，其余是绿化水域
    cZoning.setOption(Object.assign({}, commonOpt, {
        color: ['#00ffcc', '#00bfff', '#ffaa00', '#ff4455'],
        series: [{
            name: '用地类型', type: 'pie', radius: ['45%', '75%'],
            itemStyle: { borderRadius: 4, borderColor: '#050c1e', borderWidth: 2 },
            label: { color: '#7df9ff', formatter: '{b}\n{d}%' },
            data: [
                { value: Math.floor(totalB * 0.40), name: '住宅区' },
                { value: Math.floor(totalB * 0.25), name: '核心商圈' },
                { value: Math.floor(totalB * 0.20), name: '重工业区' },
                { value: Math.floor(totalB * 0.15) + lakes * 10, name: '生态绿地' }
            ]
        }]
    }));
    ecIns.push(cZoning);

    // --- 左侧下方 (折线图)：全城电力负荷监控 ---
    chartPowerLine = echarts.init(document.getElementById('c-power'), 'dark');
    let initDate = new Date();
    for (let i = 0; i < 20; i++) {
        timeData.push([initDate.getHours(), initDate.getMinutes(), initDate.getSeconds()].join(':'));
        powerData.push(Math.round(Math.random() * 200 + 800));
        initDate = new Date(+initDate - 1000);
    }
    timeData.reverse();
    powerData.reverse();

    chartPowerLine.setOption(Object.assign({}, commonOpt, {
        grid: { top: 15, bottom: 25, left: 45, right: 15 },
        xAxis: { type: 'category', data: timeData, axisLine: { lineStyle: { color: '#446688' } }, axisLabel: { fontSize: 10 } },
        yAxis: { type: 'value', min: 0, max: 2500, splitLine: { lineStyle: { color: '#112233', type: 'dashed' } }, axisLabel: { fontSize: 10 } },
        series: [{
            data: powerData, type: 'line', smooth: true,
            symbol: 'none',
            lineStyle: { color: '#ffaa00', width: 2 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(255, 170, 0, 0.5)' },
                    { offset: 1, color: 'rgba(255, 170, 0, 0)' }
                ])
            }
        }]
    }));
    ecIns.push(chartPowerLine);

    // --- 右侧上方 (雷达图)：交通车流量与行人活跃度 ---
    chartTraffic = echarts.init(document.getElementById('c-traffic'), 'dark');
    chartTraffic.setOption(Object.assign({}, commonOpt, {
        radar: {
            indicator: [
                { name: '主干道车流', max: 100 },
                { name: '行人活跃度', max: 100 },
                { name: '游乐设施承载率', max: 100 },
                { name: '停车场滞留率', max: 100 },
                { name: '交通事故发生率', max: 10 }
            ],
            shape: 'circle',
            splitNumber: 4,
            axisName: { color: '#7df9ff', fontSize: 10 },
            splitLine: { lineStyle: { color: ['rgba(0, 255, 204, 0.1)', 'rgba(0, 255, 204, 0.2)', 'rgba(0, 255, 204, 0.4)', 'rgba(0, 255, 204, 0.6)'] } },
            splitArea: { show: false },
            axisLine: { lineStyle: { color: 'rgba(0, 255, 204, 0.5)' } }
        },
        series: [{
            type: 'radar',
            data: [{
                value: [65, 80, 45, 30, 1],
                name: '实时活跃度监控',
                itemStyle: { color: '#00ffcc' },
                areaStyle: { color: 'rgba(0, 255, 204, 0.4)' }
            }]
        }]
    }));
    ecIns.push(chartTraffic);

    // --- 右侧下方：WebGL 渲染算力性能池 (实时波动的柱状图) ---
    chartPerformance = echarts.init(document.getElementById('c-drawcall'), 'dark');

    // 初始化空数据时间轴
    let pTime = new Date();
    for (let i = 0; i < 30; i++) {
        perfTimeData.push([pTime.getHours(), pTime.getMinutes(), pTime.getSeconds()].join(':'));
        dcData.push(0);
        triData.push(0);
        pTime = new Date(+pTime - 1000);
    }
    perfTimeData.reverse();

    chartPerformance.setOption(Object.assign({}, commonOpt, {
        grid: { top: 40, bottom: 25, left: 45, right: 45 }, // 增加 top 值给图例让位
        legend: { data: ['Draw Calls (次)', 'Triangles (k面)'], textStyle: { color: '#aaa', fontSize: 10 }, top: 0 },
        xAxis: { type: 'category', data: perfTimeData, axisLine: { lineStyle: { color: '#446688' } }, axisLabel: { show: false } },
        yAxis: [
            // 删除 name 属性，因为已经在 Legend 图例中说明过了，避免与坐标系顶部的刻度重叠在一起
            { type: 'value', position: 'left', splitLine: { show: false }, axisLabel: { fontSize: 9, color: '#00ffcc' }, axisLine: { lineStyle: { color: '#00ffcc' } } },
            { type: 'value', position: 'right', splitLine: { lineStyle: { color: '#112233', type: 'dashed' } }, axisLabel: { fontSize: 9, color: '#ffaa00', formatter: '{value}k' }, axisLine: { lineStyle: { color: '#ffaa00' } } }
        ],
        series: [
            {
                name: 'Draw Calls (次)',
                type: 'bar',
                yAxisIndex: 0,
                itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#00ffcc' }, { offset: 1, color: 'rgba(0,255,204,0.1)' }]), borderRadius: [2, 2, 0, 0] },
                data: dcData
            },
            {
                name: 'Triangles (k面)',
                type: 'line', // 用折线图和柱形图混合显得更高级
                smooth: true,
                yAxisIndex: 1,
                symbol: 'none',
                lineStyle: { color: '#ffaa00', width: 2 },
                data: triData
            }
        ]
    }));
    ecIns.push(chartPerformance);

    // 窗口尺寸自适应
    window.addEventListener('resize', () => {
        ecIns.forEach(c => c.resize());
    });

    // 右上角大屏显隐切换逻辑
    const toggleBtn = document.getElementById('toggle-dashboard');
    const dashLayer = document.getElementById('dashboard-layer');
    if (toggleBtn && dashLayer) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = dashLayer.classList.toggle('dash-hidden');
            toggleBtn.textContent = isHidden ? '开启大屏看板' : '隐藏大屏看板';

            // 同步给按钮自身挂载或卸载高隐秘性的潜伏态
            toggleBtn.classList.toggle('btn-stealth', isHidden);

            // 消除点击后的焦点残留，解决按钮 hover 状态粘滞的 BUG
            toggleBtn.blur();

            if (!isHidden) {
                // 重新开启时强制走一次最新数据刷新，以免出现数据断层
                updateDynamicCharts();
            }
        });
    }
}

// ==============================================
// 3. 数据流节流更新
// ==============================================
function updateDynamicCharts() {
    // 如果大屏出于隐藏状态，则挂起所有的图表数据构建和渲染，节省性能
    const dashLayer = document.getElementById('dashboard-layer');
    if (dashLayer && dashLayer.classList.contains('dash-hidden')) return;

    // ------------------------------------------
    // 折线图更新：结合昼夜状态制造大幅用电波动
    // ------------------------------------------
    let currentMode = window.currentTOD || 'day';
    let basePower = 800; // 白天基础用电负荷
    let fluctuation = 200; // 白天的波动幅度

    if (currentMode === 'night') {
        basePower = 1800; // 夜晚路灯和窗户大量开启，用电负荷激增
        fluctuation = 400; // 夜晚波动也大
    } else if (currentMode === 'dusk') {
        basePower = 1300; // 黄昏逐渐攀升
        fluctuation = 300;
    }

    let nextPower = Math.round(Math.random() * fluctuation + basePower);
    let axisData = (new Date()).toLocaleTimeString().replace(/^\D*/, '');
    timeData.shift(); timeData.push(axisData);
    powerData.shift(); powerData.push(nextPower);
    chartPowerLine.setOption({ xAxis: { data: timeData }, series: [{ data: powerData }] });

    // ------------------------------------------
    // 雷达图更新：行人与车流微小波动 (夜晚减少)
    // ------------------------------------------
    let carActive = currentMode === 'night' ? Math.floor(Math.random() * 20 + 30) : Math.floor(Math.random() * 20 + 60);
    let pedActive = currentMode === 'night' ? Math.floor(Math.random() * 10 + 10) : Math.floor(Math.random() * 20 + 75);
    let rideActive = currentMode === 'night' ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 30 + 40);

    chartTraffic.setOption({
        series: [{
            data: [{
                value: [carActive, pedActive, rideActive, Math.floor(Math.random() * 20 + 40), Math.floor(Math.random() * 2)],
                name: '实时活跃度监控'
            }]
        }]
    });

    // ------------------------------------------
    // 性能池更新：读取 THREE.WebGLRenderer 数据转为滚动柱状+折线图
    // ------------------------------------------
    if (rendererRef && rendererRef.info) {
        // 抓取并略微加一点点随机波动让图表显得“活着”，同时保持基数准确
        const baseCalls = rendererRef.info.render.calls;
        const calls = baseCalls + Math.floor(Math.random() * (baseCalls * 0.05)); // 5% 伪随机波动

        const baseTri = rendererRef.info.render.triangles;
        const trianglesK = parseFloat(((baseTri + Math.floor(Math.random() * 5000)) / 1000).toFixed(1)); // 换算为 k 并加点波动

        // 滚动数组
        let axisTime = (new Date()).toLocaleTimeString().replace(/^\D*/, '');
        perfTimeData.shift(); perfTimeData.push(axisTime);
        dcData.shift(); dcData.push(calls);
        triData.shift(); triData.push(trianglesK);

        chartPerformance.setOption({
            xAxis: { data: perfTimeData },
            series: [
                { data: dcData },
                { data: triData }
            ]
        });
    }
}
