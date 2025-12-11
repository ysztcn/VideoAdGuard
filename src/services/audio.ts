/**
 * 仅用于类型占位的模块：./services/audio
 * 实际构建时会被 webpack NormalModuleReplacementPlugin 替换为：
 * - ./services/audio.chrome.ts 或 ./services/audio.firefox.ts
 * 本文件不包含运行时代码，仅提供类型签名。
 */
export declare class AudioService {
  /** 从视频流数据中获取最低带宽的音频流URL */
  static getLowestBandwidthAudioUrl(playUrlData: any): string | null;

  /** 下载音频（Blob）— Chrome 实现可用 */
  static downloadAudio(audioUrl: string): Promise<Blob>;

  /** 下载音频（ArrayBuffer）— Firefox 实现可用 */
  static downloadAudioBytes(audioUrl: string): Promise<{ bytes: ArrayBuffer; type: string }>;

  /** 音频处理流程：下载、转换 */
  static processAudio(playUrlData: any): Promise<Blob | null>;

  /** 以 Blob 走识别（content 端转 data:URL 传给 background）— Chrome 实现可用 */
  static transcribeAudioBlob(audioBlob: Blob, fileInfo: { name?: string; type?: string }): Promise<any>;

  /** 以 ArrayBuffer 走识别（直接传给 background）— Firefox 实现可用 */
  static transcribeAudioBytes(audioBytes: ArrayBuffer, fileInfo: { name?: string; type?: string }): Promise<any>;

  /** 后台通过 URL 下载并识别（兜底） */
  static transcribeAudioByUrl(
    audioUrl: string,
    fileInfo: { name?: string; type?: string; size?: number },
    options?: { model?: string; responseFormat?: string }
  ): Promise<any>;

  /** 完整流程：下载并识别 */
  static processAndTranscribeAudio(
    playUrlData: any,
    transcribeOptions?: { model?: string; language?: string; responseFormat?: 'verbose_json' }
  ): Promise<{ transcription: any } | null>;
}