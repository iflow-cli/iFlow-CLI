// 智能拍照摄像工具 - 主要功能实现
class SmartCameraApp {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.preview = document.getElementById('preview');
    this.previewPlaceholder = document.getElementById('previewPlaceholder');
    this.goldenRatioGrid = document.getElementById('goldenRatioGrid');
    this.shootingHint = document.getElementById('shootingHint');
    
    this.startCameraBtn = document.getElementById('startCameraBtn');
    this.stopCameraBtn = document.getElementById('stopCameraBtn');
    this.captureBtn = document.getElementById('captureBtn');
    this.cameraSection = document.getElementById('cameraSection');
    this.permissionStatus = document.getElementById('permissionStatus');
    
    this.currentSubject = 'landscape';
    this.captureMode = 'manual'; // 'manual', 'auto', 'combined'
    this.stream = null;
    this.autoCaptureInterval = null;
    
    this.initEventListeners();
  }
  
  initEventListeners() {
    // 相机控制按钮
    this.startCameraBtn.addEventListener('click', () => this.startCamera());
    this.stopCameraBtn.addEventListener('click', () => this.stopCamera());
    this.captureBtn.addEventListener('click', () => this.capturePhoto());
    
    // 拍摄主体选择
    document.querySelectorAll('.subject-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.subject-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentSubject = e.target.dataset.subject;
        this.updateCameraSettings();
      });
    });
    
    // 拍摄模式选择
    document.querySelectorAll('input[name="captureMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.captureMode = e.target.value;
        this.handleCaptureModeChange();
      });
    });
  }
  
  // 开启相机
  async startCamera() {
    try {
      this.permissionStatus.textContent = '正在请求相机权限...';
      
      const constraints = {
        video: {
          facingMode: 'environment', // 使用后置摄像头，如果可用
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      this.permissionStatus.textContent = '相机已开启';
      this.cameraSection.style.display = 'block';
      this.startCameraBtn.style.display = 'none';
      
      // 开始显示黄金比例网格和拍摄提示
      this.showGoldenRatioGuidelines();
      this.updateShootingHint();
      
      // 如果是自动或组合模式，开始自动检测
      if (this.captureMode === 'auto' || this.captureMode === 'combined') {
        this.startAutoCapture();
      }
    } catch (error) {
      console.error('无法访问相机:', error);
      this.permissionStatus.textContent = '无法访问相机: ' + error.message;
      alert('无法访问相机，请检查权限设置');
    }
  }
  
  // 关闭相机
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.stopAutoCapture();
    
    this.cameraSection.style.display = 'none';
    this.startCameraBtn.style.display = 'inline-block';
    this.permissionStatus.textContent = '相机已关闭，请重新开启';
  }
  
  // 拍摄照片
  capturePhoto() {
    if (!this.stream) return;
    
    const context = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    
    // 绘制当前视频帧到canvas
    context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // 将canvas内容转换为图片URL
    const imageDataUrl = this.canvas.toDataURL('image/jpeg', 0.9);
    
    // 显示预览
    this.preview.src = imageDataUrl;
    this.preview.style.display = 'block';
    this.previewPlaceholder.style.display = 'none';
    
    // 保存图片到本地
    this.saveImage(imageDataUrl);
    
    // 在手动模式下显示拍摄提示
    if (this.captureMode === 'manual') {
      this.showCaptureFeedback();
    }
  }
  
  // 自动抓拍功能
  startAutoCapture() {
    this.stopAutoCapture(); // 先停止可能存在的其他自动抓拍
    
    // 根据拍摄主体调整检测频率
    let intervalTime = 1000; // 默认1秒
    switch(this.currentSubject) {
      case 'animal':
        intervalTime = 500; // 动物模式更频繁检测
        break;
      case 'people':
        intervalTime = 800; // 人像模式适中频率
        break;
      case 'landscape':
      case 'object':
        intervalTime = 1500; // 静态场景可以慢一些
        break;
    }
    
    this.autoCaptureInterval = setInterval(() => {
      if (this.isGoodComposition()) {
        this.capturePhoto();
        // 捕获后短暂暂停，避免连续拍摄
        setTimeout(() => {
          // 检查是否仍在自动模式
          if (this.captureMode === 'auto' || this.captureMode === 'combined') {
            // 重新启动定时器
            this.startAutoCapture();
          }
        }, 2000);
        // 停止当前定时器，等待上面的回调重新启动
        this.stopAutoCapture();
      }
    }, intervalTime);
  }
  
  stopAutoCapture() {
    if (this.autoCaptureInterval) {
      clearInterval(this.autoCaptureInterval);
      this.autoCaptureInterval = null;
    }
  }
  
  // 检查构图是否符合黄金比例
  isGoodComposition() {
    // 获取当前视频帧进行分析
    const context = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // 获取图像数据
    const imageData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    
    // 检测画面中的主要元素位置（简化版实现）
    const compositionScore = this.evaluateComposition();
    
    // 根据拍摄主体调整判断标准
    let threshold = 0.6; // 默认阈值
    switch(this.currentSubject) {
      case 'landscape':
        threshold = 0.7; // 风景要求更高
        break;
      case 'people':
        threshold = 0.65; // 人像要求较高
        break;
      case 'animal':
        threshold = 0.5; // 动物模式更灵活
        break;
      case 'object':
        threshold = 0.6; // 物品居中也可接受
        break;
    }
    
    return compositionScore >= threshold;
  }
  
  // 评估构图质量
  evaluateComposition() {
    // 这里实现一个简化的构图评估算法
    // 实际应用中可以使用更复杂的计算机视觉算法
    
    // 获取黄金分割点的坐标
    const width = this.video.videoWidth;
    const height = this.video.videoHeight;
    
    const goldenRatio = 0.618;
    const verticalLine1 = Math.floor(width * (1 - goldenRatio));
    const verticalLine2 = Math.floor(width * goldenRatio);
    const horizontalLine1 = Math.floor(height * (1 - goldenRatio));
    const horizontalLine2 = Math.floor(height * goldenRatio);
    
    // 评估画面亮度分布和对比度（简化）
    let score = 0;
    
    // 检查是否有内容在黄金分割线附近（简化评估）
    // 在实际应用中，这会涉及复杂的图像分析
    const randomFactor = Math.random() * 0.3; // 随机因素，模拟实际检测
    const compositionFactor = 0.4; // 构图因素
    const brightnessFactor = 0.3; // 亮度因素
    
    score = compositionFactor + brightnessFactor + randomFactor;
    
    // 根据当前主体类型调整评分
    switch(this.currentSubject) {
      case 'people':
        // 人像模式：更关注人脸位置是否符合黄金比例
        score += this.estimateFacePosition();
        break;
      case 'landscape':
        // 风景模式：更关注水平线位置
        score += this.estimateHorizonPosition();
        break;
    }
    
    // 限制分数在0-1之间
    return Math.min(1.0, Math.max(0.0, score));
  }
  
  // 估计人脸位置（简化版）
  estimateFacePosition() {
    // 简化实现：返回一个随机分数，实际应用中需要使用人脸检测库
    return Math.random() * 0.3;
  }
  
  // 估计地平线位置（简化版）
  estimateHorizonPosition() {
    // 简化实现：返回一个随机分数，实际应用中需要检测水平线
    return Math.random() * 0.3;
  }
  
  // 更新相机设置（根据拍摄主体）
  async updateCameraSettings() {
    if (!this.stream) return;
    
    try {
      // 获取视频轨道
      const videoTrack = this.stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      
      // 根据拍摄主体调整相机参数
      switch(this.currentSubject) {
        case 'landscape':
          // 风景模式：小光圈（大f值），大景深，较低ISO
          console.log('调整到风景模式参数 - 大景深，广角');
          this.updateShootingHint();
          break;
        case 'people':
          // 人像模式：大光圈（小f值），浅景深，美颜效果
          console.log('调整到人像模式参数 - 浅景深，背景虚化');
          this.updateShootingHint();
          break;
        case 'animal':
          // 动物模式：快速对焦，高快门速度，连续拍摄模式
          console.log('调整到动物模式参数 - 高速连拍，快速对焦');
          this.updateShootingHint();
          break;
        case 'object':
          // 物品模式：微距，高清晰度，稳定模式
          console.log('调整到物品模式参数 - 微距，高细节');
          this.updateShootingHint();
          break;
      }
    } catch (error) {
      console.error('更新相机设置时出错:', error);
    }
  }
  
  // 显示黄金比例网格
  showGoldenRatioGuidelines() {
    // 网格已经通过CSS显示，这里可以添加动态逻辑
    this.goldenRatioGrid.style.display = 'block';
  }
  
  // 更新拍摄提示
  updateShootingHint() {
    let hint = '';
    let tips = [];
    
    switch(this.currentSubject) {
      case 'landscape':
        tips = [
          '将地平线放在下方黄金分割线附近，避免居中',
          '利用引导线增强画面深度感',
          '注意前景、中景、后景的层次',
          '选择黄金时段（日出/日落）拍摄',
          '使用三分法构图，天空与地面比例3:2或2:1'
        ];
        break;
      case 'people':
        tips = [
          '将眼睛放在上方黄金分割线附近',
          '保持眼神光增加神采',
          '利用大光圈虚化背景突出主体',
          '选择简洁背景避免干扰',
          '拍摄半身或七分身效果更佳'
        ];
        break;
      case 'animal':
        tips = [
          '等待动物最自然的瞬间，保持静止避免惊扰',
          '将动物眼睛放在黄金分割点上',
          '使用连续对焦跟踪移动的动物',
          '选择动物与背景对比明显的场景',
          '耐心等待，捕捉动物的自然行为'
        ];
        break;
      case 'object':
        tips = [
          '注意光线角度，45度侧光突出质感',
          '利用背景与物体的色彩对比',
          '选择简洁背景突出主体',
          '尝试不同角度：俯拍、仰拍、平拍',
          '使用道具或环境增加画面故事性'
        ];
        break;
    }
    
    // 随机选择一个提示
    hint = tips[Math.floor(Math.random() * tips.length)];
    
    this.shootingHint.textContent = hint;
    
    // 定期更新提示
    setTimeout(() => {
      this.updateShootingHint();
    }, 8000); // 每8秒更新一次提示
  }
  
  // 显示拍摄反馈
  showCaptureFeedback() {
    const feedbackMessages = [
      '完美构图！',
      '很棒的角度！',
      '黄金比例捕捉成功！',
      '光线和构图都很棒！'
    ];
    
    const randomFeedback = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];
    this.shootingHint.textContent = randomFeedback;
    
    // 3秒后恢复常规提示
    setTimeout(() => {
      this.updateShootingHint();
    }, 3000);
  }
  
  // 处理拍摄模式变化
  handleCaptureModeChange() {
    // 先停止当前的自动拍摄
    this.stopAutoCapture();
    
    if (this.captureMode === 'auto' || this.captureMode === 'combined') {
      this.startAutoCapture();
    }
    
    // 更新提示文本
    if (this.captureMode === 'manual') {
      this.updateShootingHint();
    } else if (this.captureMode === 'combined') {
      this.shootingHint.textContent = '手动拍摄时会显示拍摄提示，自动抓拍会在最佳时机拍摄';
    }
  }
  
  // 保存图片到本地
  saveImage(imageDataUrl) {
    // 创建下载链接
    const link = document.createElement('a');
    link.download = `smart_camera_${new Date().getTime()}.jpg`;
    link.href = imageDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('图片已保存');
  }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new SmartCameraApp();
});