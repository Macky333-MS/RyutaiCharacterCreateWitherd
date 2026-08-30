# 龍体文字Web V3.14

## V3.14の変更
- Windowsで共有メニュー内の「個別保存」「ZIP保存」が反応しない問題を修正。
- Chrome / Edgeでは File System Access API を利用し、個別保存では保存先フォルダー、ZIP保存では保存先ファイルを先に選択する方式へ変更。
- File System Access API非対応ブラウザでは従来のダウンロード方式へ自動フォールバック。
- 保存失敗時は共有画面内にエラー内容を表示。
- Version 3.14 を画面右下に表示。
- Service WorkerキャッシュをV3.14へ更新。
- 龍体文字フォントを assets/fonts/pkryutaib3-Regular.otf に同梱。
