export {};
import { WhitelistService } from './services/whitelist';  
import { BilibiliService } from './services/bilibili';    

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl") as HTMLInputElement;
  const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
  const modelInput = document.getElementById("model") as HTMLInputElement;
  const messageDiv = document.getElementById("message") as HTMLInputElement;
  const resultDiv = document.getElementById("result") as HTMLInputElement;
  const enableExtensionCheckbox = document.getElementById("enableExtension") as HTMLInputElement;
  const localOllamaCheckbox = document.getElementById("localOllama") as HTMLInputElement;
  const autoSkipAdCheckbox = document.getElementById("autoSkipAd") as HTMLInputElement;
  const restrictedModeCheckbox = document.getElementById("restrictedMode") as HTMLInputElement;
  const togglePasswordBtn = document.getElementById("toggleApiKey") as HTMLInputElement;
  const groqApiKeyInput = document.getElementById("groqApiKey") as HTMLInputElement;
  const toggleGroqPasswordBtn = document.getElementById("toggleGroqApiKey") as HTMLInputElement;
  const enableAudioTranscriptionCheckbox = document.getElementById("enableAudioTranscription") as HTMLInputElement;
  const enableGroqProxyCheckbox = document.getElementById("enableGroqProxy") as HTMLInputElement;

  // API URL 下拉框相关元素
  const apiUrlDropdown = document.getElementById("apiUrlDropdown") as HTMLButtonElement;
  const apiUrlDropdownMenu = document.getElementById("apiUrlDropdownMenu") as HTMLDivElement;

  // 默认勾选启用和自动跳过广告，若读取到存储值会覆盖
  enableExtensionCheckbox.checked = true;
  autoSkipAdCheckbox.checked = true;

  // 自动保存函数
  async function autoSaveSettings() {
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const model = modelInput.value.trim();
    const enableExtension = enableExtensionCheckbox.checked;
    const enableLocalOllama = localOllamaCheckbox.checked;
    const autoSkipAd = autoSkipAdCheckbox.checked;
    const restrictedMode = restrictedModeCheckbox.checked;
    const groqApiKey = groqApiKeyInput.value.trim();
    const enableAudioTranscription = enableAudioTranscriptionCheckbox.checked;
    const enableGroqProxy = enableAudioTranscription && enableGroqProxyCheckbox ? enableGroqProxyCheckbox.checked : false;

    // 基本验证
    if (!apiUrl) {
      console.warn('API地址为空');
    }

    if (!enableLocalOllama && !apiKey) {
      console.warn('API密钥为空');
    }

    if (!model) {
      console.warn('模型名称为空');
    }

    try {
      await chrome.storage.local.set({
        apiUrl,
        apiKey,
        model,
        enableExtension,
        enableLocalOllama,
        autoSkipAd,
        restrictedMode,
        groqApiKey,
        enableAudioTranscription,
        enableGroqProxy
      });
    } catch (error) {
      console.warn('保存设置失败:', error);
    }
  }

  // ========== 统一的事件绑定：所有输入框和复选框变化时立即保存 ==========
  
  // 所有复选框 - change 事件立即保存
  const allCheckboxes = [
    enableExtensionCheckbox,
    autoSkipAdCheckbox,
    restrictedModeCheckbox,
    localOllamaCheckbox,
    enableAudioTranscriptionCheckbox,
    enableGroqProxyCheckbox
  ].filter(Boolean); // 过滤掉可能不存在的元素

  allCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      autoSaveSettings();
    });
  });

  // 所有文本输入框 - input 事件实时保存 + blur 事件兜底保存
  const allTextInputs = [
    apiUrlInput,
    apiKeyInput,
    modelInput,
    groqApiKeyInput
  ].filter(Boolean);

  allTextInputs.forEach(input => {
    // 输入时实时保存（带防抖）
    let debounceTimer: number | null = null;
    input.addEventListener('input', () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        autoSaveSettings();
      }, 500); // 500ms 防抖
    });

    // 失去焦点时立即保存（兜底）
    input.addEventListener('blur', () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      autoSaveSettings();
    });
  });

  // 页面卸载时自动保存（兜底）
  window.addEventListener('beforeunload', autoSaveSettings);

  // 页面隐藏时自动保存（用户切换标签页或关闭popup，兜底）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      autoSaveSettings();
    }
  });

  // 窗口失去焦点时保存（额外兜底，针对 Mac 等平台）
  window.addEventListener('blur', autoSaveSettings);

  // API URL 下拉框功能
  function initApiUrlDropdown() {
    // 切换下拉菜单显示/隐藏
    apiUrlDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      apiUrlDropdownMenu.classList.toggle('show');
    });

    // 点击下拉项时选择API URL
    apiUrlDropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = e.target as HTMLElement;

      // 处理注册链接点击
      if (target.classList.contains('register-link')) {
        return; // 让链接正常跳转
      }

      // 查找最近的dropdown-item
      const dropdownItem = target.closest('.dropdown-item') as HTMLElement;
      if (dropdownItem) {
        const url = dropdownItem.getAttribute('data-url');
        if (url) {
          apiUrlInput.value = url;
          apiUrlDropdownMenu.classList.remove('show');
          // 触发自动保存
          autoSaveSettings();
        }
      }
    });

    // 点击其他地方时关闭下拉菜单
    document.addEventListener('click', () => {
      apiUrlDropdownMenu.classList.remove('show');
    });

    // 阻止输入框点击时关闭下拉菜单
    apiUrlInput.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // 初始化下拉框功能
  initApiUrlDropdown();


  if (togglePasswordBtn && apiKeyInput) {
    togglePasswordBtn.addEventListener("click", () => {
      // 只需切换输入框类型，图标显示由CSS控制      
      const type = apiKeyInput.getAttribute("type") === "password" ? "text" : "password";
      apiKeyInput.setAttribute("type", type);
    });
  }

  // Ollama 复选框的额外逻辑：切换 CSS 类
  localOllamaCheckbox.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    // 使用CSS类来控制显示/隐藏，而不是直接修改display属性
    if (target.checked) {
      document.body.classList.add('ollama-enabled');
    } else {
      document.body.classList.remove('ollama-enabled');
    }
  });

  // 添加Groq API密钥切换功能
  if (toggleGroqPasswordBtn && groqApiKeyInput) {
    toggleGroqPasswordBtn.addEventListener("click", () => {
      const type = groqApiKeyInput.getAttribute("type") === "password" ? "text" : "password";
      groqApiKeyInput.setAttribute("type", type);
    });
  }

  function updateAudioTranscriptionState(enabled: boolean) {
    document.body.classList.toggle('audio-transcription-enabled', enabled);
    if (!enabled && enableGroqProxyCheckbox) {
      enableGroqProxyCheckbox.checked = false;
    }
  }

  // 音频转录复选框的额外逻辑：更新 CSS 类
  enableAudioTranscriptionCheckbox.addEventListener('change', () => {
    const enabled = enableAudioTranscriptionCheckbox.checked;
    updateAudioTranscriptionState(enabled);
  });

  // 加载已保存的设置
  const settings = await chrome.storage.local.get([
    "apiUrl",
    "apiKey",
    "model",
    "enableExtension",
    "enableLocalOllama",
    "autoSkipAd",
    "restrictedMode",
    "groqApiKey",
    "enableAudioTranscription",
    "enableGroqProxy",
  ]);

  if (settings.apiUrl) {
    apiUrlInput.value = settings.apiUrl;
  }
  if (settings.apiKey) {
    apiKeyInput.value = settings.apiKey;
  }
  if (settings.model) {
    modelInput.value = settings.model;
  }
  if (typeof settings.enableExtension === 'boolean') {
    enableExtensionCheckbox.checked = settings.enableExtension;
  }
  if (settings.enableLocalOllama) {
    localOllamaCheckbox.checked = settings.enableLocalOllama;
    // 使用CSS类而不是直接修改样式
    document.body.classList.add('ollama-enabled');
  }
  if (typeof settings.autoSkipAd === 'boolean') {
    autoSkipAdCheckbox.checked = settings.autoSkipAd;
  }
  if (settings.restrictedMode) {
    restrictedModeCheckbox.checked = settings.restrictedMode;
  }
  if (settings.groqApiKey) {
    groqApiKeyInput.value = settings.groqApiKey;
  }
  if (typeof settings.enableAudioTranscription === 'boolean') {
    enableAudioTranscriptionCheckbox.checked = settings.enableAudioTranscription;
  }
  updateAudioTranscriptionState(enableAudioTranscriptionCheckbox.checked);
  if (enableGroqProxyCheckbox) {
    enableGroqProxyCheckbox.checked = enableAudioTranscriptionCheckbox.checked
      ? Boolean(settings.enableGroqProxy)
      : false;
  }

  // 获取当前标签页的广告检测结果
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (!currentTab || !currentTab.id) return;

    // 检查是否在B站视频页面
    if (!currentTab.url?.includes('bilibili.com/video/') && 
    !currentTab.url?.includes('bilibili.com/list/watchlater')) {
      resultDiv.textContent = '当前不在哔哩哔哩视频页面';
      return;
    }

    chrome.tabs.sendMessage(currentTab.id, { type: 'GET_AD_INFO' }, (response) => {
      if (chrome.runtime.lastError) {
        resultDiv.textContent = '插件未完全加载，请等待或刷新';
        return;
      }

      if (response && response.adInfo) {
        resultDiv.textContent = `${response.adInfo}`;
      } else {
        resultDiv.textContent = '未检测到广告信息';
      }
    });
  });

  const enableWhitelistCheckbox = document.getElementById("enableWhitelist") as HTMLInputElement;
  const upUidInput = document.getElementById("upUid") as HTMLInputElement;
  const addToWhitelistButton = document.getElementById("addToWhitelist") as HTMLButtonElement;
  const whitelistList = document.querySelector(".whitelist-list") as HTMLDivElement;

  // 加载白名单配置
  const whitelistConfig = await WhitelistService.getConfig();
  enableWhitelistCheckbox.checked = whitelistConfig.enabled;
  document.body.classList.toggle('whitelist-enabled', whitelistConfig.enabled);

  // 渲染白名单列表
  function renderWhitelistItems() {
    // 清空现有内容
    whitelistList.innerHTML = '';
    // 安全地创建DOM元素
    whitelistConfig.whitelistedUPs.forEach(up => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'whitelist-item';
      
      const span = document.createElement('span');
      span.textContent = `${up.name} (UID: ${up.uid})`;
      
      const button = document.createElement('button');
      button.textContent = '移除';
      button.dataset.uid = up.uid;
      
      itemDiv.appendChild(span);
      itemDiv.appendChild(button);
      whitelistList.appendChild(itemDiv);
    });
  }
  renderWhitelistItems();

  // 启用/禁用白名单
  enableWhitelistCheckbox.addEventListener('change', async () => {
    await WhitelistService.setEnabled(enableWhitelistCheckbox.checked);
    document.body.classList.toggle('whitelist-enabled', enableWhitelistCheckbox.checked);
  });

  // 添加UP主到白名单
  addToWhitelistButton.addEventListener('click', async () => {
    const uid = upUidInput.value.trim();
    if (!uid) {
      messageDiv.textContent = '请输入UP主UID';
      messageDiv.className = 'error';
      messageDiv.style.display = 'block';
      return;
    }

    try {
      // 获取UP主信息
      const upInfo = await BilibiliService.getUpInfo(uid);
      const added = await WhitelistService.addToWhitelist({
        uid: uid,
        name: upInfo.name
      });

      if (added) {
        messageDiv.textContent = '已添加到白名单';
        messageDiv.className = 'success';
        messageDiv.style.display = 'block';
        upUidInput.value = '';
        whitelistConfig.whitelistedUPs = (await WhitelistService.getConfig()).whitelistedUPs;
        renderWhitelistItems();
      } else {
        messageDiv.textContent = '该UP主已在白名单中';
        messageDiv.className = 'error';
        messageDiv.style.display = 'block';
      }
    } catch (error) {
      messageDiv.textContent = '添加失败：' + (error as Error).message;
      messageDiv.className = 'error';
      messageDiv.style.display = 'block';
    }
  });

  // 移除白名单中的UP主
  whitelistList.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON') {
      const uid = target.dataset.uid;
      if (uid) {
        await WhitelistService.removeFromWhitelist(uid);
        whitelistConfig.whitelistedUPs = (await WhitelistService.getConfig()).whitelistedUPs;
        renderWhitelistItems();
        messageDiv.textContent = '已从白名单移除';
        messageDiv.className = 'success';
        messageDiv.style.display = 'block';
      }
    }
  });
});
