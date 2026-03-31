export interface RepubConfig {
  title: string;
  author?: string;
  entry?: string;
  outputPath?: string;
}

export interface RepubManifest {
  formatVersion: number;
  title: string;
  author?: string;
  entry: string;
  dependencies?: Record<string, string>;
  buildInfo?: {
    builderVersion?: string;
    buildTime?: string;
  };
}
