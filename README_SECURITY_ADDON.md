# Integrated security‑addon (prompt + code review)

このテンプレートは以下の安全機構を標準搭載しました。

1. **プロンプト検疫**: `utils/promptScanner.js` – `gpt‑3.5‑turbo-1106` で注入攻撃を検査  
2. **生成コード監査**: `utils/codeReviewer.js` – `gpt‑4o‑mini` でハイレベル脆弱性を検出し、必要に応じ自動パッチ
3. **エラー / 警告の GUI 連携**: `ipcMain` から `{ error | warning, issues, patchedCode, diff }` を返却

追加済みの依存:

```bash
npm i openai jsdiff
```

詳細な統合手順はソース内コメントを参照してください。