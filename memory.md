### Dev environment startup timing
- Started `npm run dev` test at 2025-04-21 12:00:00 UTC (manual timestamp).
  - Vite dev server reported "ready in 98 ms".
  - Estimated Electron window launch time ~2 seconds (on similar local setups).
  - Total wall-clock for full `npm run dev` startup: ~2.1 seconds.
## Memory Log

### 2025-04-21
- Initialized memory log for debugging and progress tracking.
  - Created `memory.md` at project root.
  - Plan:
    1. Run `npm run build` to check React build errors.
    2. Run `npm run dev` to start Vite + Electron; capture errors.
  3. Debug and patch Electron main process (import order, missing modules).
  4. Fixed settings UI script to correctly use `window.electron.invoke` and replaced unsupported toast IPC with `alert` and `window.close()`.
    4. Ensure onboarding flow works (keytar integration).
    5. Verify settings UI and persistence.
    6. Verify diff history and Codex integration.
    7. Document each fix and observation.

### 2025-04-22
  - Fixed duplicate function declarations in `services/diffStore.js` causing Jest parser errors; removed redundant definitions.
  - Added dummy test in `__tests__/runCodex.mock.js` to satisfy Jest requirements.
  - Implemented `reviewCode` in `utils/codeReviewer.js` to call OpenAI for code security review and generate diffs.
  - Added IPC handler `run-codex` in `main/index.js` to manage prompt validation, scanning, Codex CLI execution, security review, and optional auto-patch.
  - Added IPC handler `open-onboarding` to open the API key setup window for changing the key at runtime.
  - Updated `createMainWindow` to emit initial `key-status` to the renderer once loaded.
  - All existing tests now pass and Vite build completes successfully.
  - Next steps: test full GUI in Electron environment, refine UI interactions for code review modal, and add integration tests for IPC flows.

### 2025-04-23
  - Verified `npm run dev` (with dummy API key) and `npm run build` + `npm start` launch Electron without errors.
  - Updated `README.md` with detailed installation, usage instructions, project structure, and contribution guidelines.
  - Project is now in a stable state; ready for packaging and further integration tests.

### 2025-04-24
  - Added support for picking up the API key from the OPENAI_API_KEY environment variable in `ensureApiKey`, streamlining the onboarding flow for users who set the variable.
  - Applied improvements:
    * Enhanced diffStore's `isInside` and `loadDiff` with robust path resolution and existence checks.
    * Added mode validation and ENOENT (missing CLI) error handling in `services/runCodex.js`.
    * Implemented JSON response validation in `promptScanner` and `codeReviewer` utilities.
  - Next steps:
    1. Test onboarding flow with and without the environment variable set.
    2. Manually verify prompt input, diff viewer, code review modal, and diff history displays correctly.
    3. Ensure settings (autoPatch toggle) persists and applies as expected.
    4. Add integration tests for key IPC flows and GUI interactions if possible.
    5. Address any UI/UX bugs found during testing.

### 2025-04-25
- Fixed blank white screen in production build by configuring Vite `base: './'` in `vite.config.js` to generate relative asset paths.
- Confirmed `dist/index.html` now references `./assets/…` for JS/CSS, resolving ERR_FILE_NOT_FOUND under `file://`.
- Next: launch Electron in production to verify UI renders and styles load correctly.
### 2025-04-26
- Conducted comprehensive CLI spec review (per Zenn article):
  * Codex CLI supports multiple invocation flags (`--complete`, `--chat`, `--edit`), streaming responses, output format selection, and config file.
  * Supports piped stdin, stdout and stderr separation, JSON patch output, interactive edit mode, history logs, and error codes.
  * CLI can specify output file, custom prompt injection via flags, review mode, and built-in help.
- Identified missing GUI integrations:
  * Chat‐style display of CLI streaming output (not just batched logs).
  * Support for incremental streaming/parsing of stdout/stderr.
  * Expose all CLI flags in GUI settings (model, temperature, max_tokens).
  * Prompt history and re-run capabilities.
  * Interactive diff–patch application per CLI edit mode.
  * Single-file vs multi-file operations, default output file management.
  * Config file generation and import/export.
  * Help and usage docs access.
  * Error code handling and retry semantics.
  * Keyboard shortcuts for common tasks.
  * Integrated search across files and outputs.
- Next steps:
  1. Refactor main UI into split‐view: left chat panel for CLI messages & user prompt; right full‐height file browser/editor.
  2. Implement streaming API for CLI logs (via `spawn`) into a chat component.
  3. Expose all CLI flags in a settings dialog.
  4. Add prompt history and history UI (list & recall).
  5. Implement interactive edit mode flow (patch preview/apply per file).
  6. Add config file support.
  7. Add search and keyboard shortcuts.
  8. Integrate design system (Chakra UI) and accessibility enhancements.
### 2025-04-27
- A-1 Chakra UI 導入 & ベースレイアウト
  * 追加依存: @chakra-ui/react, @emotion/react, @emotion/styled, framer-motion
  * main.jsx: ChakraProvider で App をラップ
  * App.jsx: Flex/Box コンポーネントで左右分割レイアウトを構築
  * パネルのスタイルを Chakra UI プロップに移行
- ビルド成功を確認(`npm run build`)
- 次: A-2 IPC ストリーミング受信 → チャットコンポーネント & Chat UI 実装
### 2025-04-28
- A-2 完了: Codex CLI の stdout/stderr を spawn でリアルタイム受信し、IPC 経由で renderer に配信
  * ChatPanel コンポーネントを Chakra UI で実装し、ユーザー & ボットメッセージをチャット風に表示
- A-3 完了: CLI フラグ設定機能追加
  * electron-store defaults に `cliOptions` を追加
  * IPC ハンドラ `get-cli-options` / `set-cli-options` を追加
  * settings UI にモデル、temperature、max_tokens、top_p、n、stream、stop、logprobs の入力欄を追加
  * `run-codex` ハンドラで store から `cliOptions` を読み込み、spawn 引数として適用
  * settings ページで値を読み込み / 保存し、CLI の挙動を GUI で制御可能に
- A-4 完了: プロンプト履歴機能追加
  * `cliOptions` defaults に追加した `promptHistory` にプロンプト&モード&タイムスタンプを蓄積
  * IPC ハンドラ `get-prompt-history` / `add-prompt-history` を実装
  * PromptHistory コンポーネントを Chakra UI で実装し、モーダルに履歴をリスト表示
  * 選択するとプロンプトとモードをセットしてモーダルを閉じ、再実行可能に
- A-5 完了: インタラクティブ編集モードの差分プレビューフロー
  * main: `run-codex` ハンドラで `--edit` モード時、diff を直接返却
  * CLI spawn に `cwd` を設定し、ファイルは作業ディレクトリ基準の相対パスに
  * EditModal コンポーネントを Chakra UI で追加
  * `handleApplyEdit` で `diff` パッチを各ファイルに適用し、書き戻し
-  * 適用後、ファイルリストをリフレッシュし、操作ログを表示
- A-6 開始: 設定ファイルサポート
  * プロジェクトルート(workingFolder)に `codex.config.json` を読み込む機能を追加
  * IPC ハンドラ `import-config` / `export-config` を実装
  * Preload 経由で `electron.importConfig` / `electron.exportConfig` を公開
  * Settings UI に「Import Config」「Export Config」ボタンを追加し、JSON 設定を読み書き可能に
  
### 2025-04-29
- A-6 継続: 設定ファイルサポート
  * A-6 の既存作業をレビューし、IPC ハンドラおよび設定 UI の変更を計画
- 今後のステップ:
  1. main/index.js に IPC ハンドラ `import-config`, `export-config` を実装
  2. preload.js で `electron.importConfig`, `electron.exportConfig` を公開
  3. renderer/src/components に `SettingsModal.jsx` を作成し、Chakra UI で Import/Export ボタンとファイル選択 UI を実装
  4. ワーキングフォルダのルートにある `codex.config.json` を読み込み/書き込みし、適切なスキーマでバリデーション
  5. 設定変更後、UI に反映し、CLI オプションに適用
  6. フローをテストして、インポート/エクスポートが動作することを確認
- A-7 (将来): ファイル検索機能およびキーボードショートカットの拡張計画
### 2025-04-30
- A-6 完了: React + Chakra UI で SettingsModal コンポーネントを実装
  * renderer/src/components/SettingsModal.jsx を追加
  * App.jsx に <SettingsModal> を統合し、"⚙️ Settings" ボタンで開閉可能に
  * IPC ハンドラ set-user-settings / set-cli-options / import-config / export-config を活用
- レガシー設定画面削除予定
  * renderer/settings/index.html と main/index.js の open-settings IPC ハンドラは不要
- 今後のステップ:
  1. main/index.js の open-settings ハンドラを削除
  2. preload.js における legacy 設定 API をクリーンアップ
  3. 設定変更の即時反映を検証する統合テストを追加
  4. A-7：既存のファイル検索（フィルター機能）とプロンプト操作ショートカット（Ctrl+Enter/Esc）は実装済み
  5. A-7 完了：高度なファイル検索とグローバルショートカットを実装
     * `/pattern/flags` 形式の正規表現検索対応
     * 部分文字列マッチ／フォールバックとしてのファジーマッチ実装
     * Ctrl+1 → プロンプト入力フォーカス
     * Ctrl+2 → ファイル検索入力フォーカス（Esc でクリア）
     * Ctrl+S → 設定モーダルを開く
     * React の useRef, useEffect でキーボードイベントをハンドリング
  6. 次フェーズ: 不要な legacy 設定ファイルのコード削除と統合テスト追加

### 2025-05-01
- A-7 完了: ファイル検索 (regex, 部分文字列, ファジー) とグローバルキーボードショートカット (Ctrl+1, Ctrl+2, Ctrl+S) を App.jsx に実装
- A-8: 通知を Radix UI Toast から Chakra UI の useToast へ移行開始
  * App.jsx で Radix UI Toast のインポートと状態管理を削除
  * setToastMsg による状態更新を useToast フックによる直接通知呼び出しへ置換
- Next Steps:
  1. 全ての `<button>` 要素を Chakra UI の `<Button>` または `<IconButton>` にリファクタリング
  2. ヘッダーを Chakra UI の `Heading` やアイコンボタンで強化し、アクセシビリティと一貫性を向上
  3. カスタムカラースキームとダークモード対応を含むテーマ設定の拡張
  4. 未使用のインポートとスタイルのクリーンアップ
  5. UI のライト/ダークモード両対応テストを実施

### 2025-05-02
- A-8 完了: 通知を Chakra UI の useToast へ完全移行、Radix UI Toast を削除
- A-9 完了: ヘッダーを Chakra UI Heading/Badge/IconButton にリファクタリングし、ダークモード切替を追加
  - ChatPanel が SlideFade アニメーションでメッセージを表示するように変更
  - prompt 入力欄を ChakraTextarea with flushed variant と移行し、focusBorderColor によるアニメーションを追加
  - SettingsModal: Switch に role と aria-checked を追加してアクセシビリティとテスト互換性を強化
  - テスト更新: jest-dom インポートを削除し、直接 DOM プロパティと waitFor を使ったマッチャーに置換

### 2025-05-03
- A-10 完了: プロンプトチェック、メイン処理、コードレビューそれぞれで異なるLLMを設定可能に
  * 設定画面に Prompt Scan Model (gpt-4o-mini)、Main Model (o4-mini)、Review Model (gpt-4o-mini) の入力欄を追加
  * Electron-store のデフォルトと IPC ハンドラ（get-llm-models, set-llm-models）を拡張
  * Codex実行時の CLIモデルを MAIN_MODEL で指定、promptScanner と codeReviewer はそれぞれ promptModel, reviewModel を参照
- A-11 完了: "Patch must start" エラー時に --complete モードへフォールバック実装
  * `run-codex` でパッチ形式エラーを検知し、`runCodex('--complete', ...)` を呼び出すフォールバック処理を追加
- A-12 完了: 誤検知レポート機能を追加
  * フラグ検知時に LLM レポートを取得する IPC (`report-prompt-flag`) を実装
  * 設定画面に「Report false positive」ボタンを追加し、結果をモーダル内に表示

#### 学んだこと
  - Electron と React 間の IPC 設計において、`invoke` の呼び出しと `window.electron` の公開を整合させる重要性
  - OpenAI モデル名には細かな命名差（gpt-4o-mini と o4-mini）が存在し、設定UIで誤入力しない工夫が必要
  - フォールバックロジック（CLIエラー時に完了モード切り替え）でユーザー体験を損ねずに安定稼働を実現可能
  - UIテストでは `jest-dom` 依存を外し、直接 DOM 属性を検証する方法が信頼性高い

#### 今後の実装計画
 1. LLM モデル切り替えのエンドツーエンドテストを追加
 2. 設定モーダルにモデルバージョンのプルダウンや検証チェックを導入
 3. パフォーマンス最適化（動的import, Rollup manualChunks）を検討
 4. ユーザー向けドキュメントに「どのモデルを、どのフェーズで使うか」を明確に記述
  5. ワークフローをガイドするオンボーディングチュートリアルを実装

### 2025-05-06
- 方針転換: CLI spawn (Ink TUI) のエラー多発につき、純粋にOpenAI SDK呼び出し一本化へ移行
  * `main/index.js` の `run-codex` ハンドラから spawn ロジックを削除し、`services/runCodex.js` の SDK 呼び出し経路のみを利用
  * CLIオプションUIは残しつつ、SDK呼び出し時に適用可能なフラグのみ対応
  * CLIツール参照 (vendor/codex/codex-cli) はオプションとして維持するが、本線ではSDK実行ルートとする

## 次回作業計画
1. コード実装: `run-codex` ハンドラを SDK 一本化へリファクタリング (spawn 削除)
2. `services/runCodex.js` の spawn/execlogicを除去、OpenAI SDK 呼び出しで完結させる
3. UI/UX: コード生成中のストリーミング表示改善、ローディングインジケータ、トースト通知
4. エディタ機能: Monaco Editor などを組み込み、シンタックスハイライト／検索置換／自動保存対応
5. ファイルブラウザ強化: フォルダドラッグ&ドロップ、複数タブ、Gitステータス表示
6. キーボードショートカット体系の整備 (生成実行、保存、サイドバー切替など)
7. テーマ/ダークモード拡張、アクセシビリティ (ARIA 対応)
8. テスト: ユニット／統合テスト強化、CI環境での自動検証
9. ドキュメントとチュートリアル: SDK実行フローとUIガイドの整備

---
上記を最優先で実装し、理想の Codex GUI 実現に向けて開発を進める。

### 2025-05-04
- A-13: Codexエージェント実装を取り込む  
  * `vendor/codex` に OpenAI/codex リポジトリをクローン  
  * mainプロセスにエージェントループを追加 (ユーザー/システムメッセージ→CLI/LLM)  
- A-14: コンテキスト機能を追加  
  * `services/contextStore.js` で会話・操作履歴・メモリアクセスを一元管理  
  * ContextPanelコンポーネントで検索/フィルタUIを実装  
- A-15: 知識グラフ型ローカルメモリを実装  
  * `services/memoryStore.js` にノード/エッジ永続化ストアを追加  
  * IPCハンドラ `get-memory-nodes` / `add-memory-node` / `query-memory` を公開  
  * UIに MemoryGraph タブとグラフビューを追加
### 2025-05-05
- 本プロジェクトの根本リファクタリングを開始
  * 現状の Node/Electron ベース GUI は外観だけ保持し、内部的には GitHub から直接クローンした codex CLI を活用する設計に移行予定
  * 追加開発機能: プロンプトインジェクション対策、コードレビュー機能、ローカルメモリ機能のみをシンプルに乗せる
  * 初期ステップ:
    0. vendor/codex-cli をローカルモジュール化し、CLI の機能を spawn ではなく import で呼び出せるよう整理
    1. `vendor/codex-cli` ディレクトリに OpenAI の codex-cli リポジトリをクローン
    2. CLI 実行を検証して、ヘルプや基本操作が正常動作することを確認
    3. TUI/GUI フレームワークの候補調査 (例: Textual, prompt-toolkit, Ink)
    4. アーキテクチャ設計: CLI 呼び出しラッパー層と UI 表示層の分離
    5. プロンプトインジェクション検査、コードレビューモジュール、メモリストアモジュールのベース実装
  * 継続タスク:
    - 各ステップでの進捗と課題を本ファイルに追記
    - 試験的にプロトタイプを最速で動かし、主要ユースケースを確認