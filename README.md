# 群眾標註
群眾標註是讓公民科學社群分享影像資訊與知識的工具，產出的資料集可以提供機器學習(AI訓練)，也可以提供社群學習(新手訓練)。 凡舉生態調查、資源盤點、汙染回報、動植物辨識、病蟲害辨識、垃圾分類等，跟影像辨識相關的議題都可以利用此工具協助收集、分析資料。

### 基本功能demo影片
[![基本功能demo](http://img.youtube.com/vi/PKVwInFUcRQ/0.jpg)](https://www.youtube.com/watch?v=PKVwInFUcRQ)


## 一般功能
- **觀看資料集**：觀看公開資料集內的影像、標註、影像資訊。

- **影像上傳**：提供使用者拍照上傳、檔案上傳(需登入)，以及程式API上傳(需取得API金鑰)。

- **影像標註**：依據資料集設定可使用整張標註(一張影像給一個標籤，用來訓練classification)，或是框選標註(框選出影像中的物件並給予標籤，用來練訓detection)。

- **影像驗證**：採用群眾投標的方式驗證影像標註品質，若標註人數大於設定值且認同率超過設定比例，則視為標註完成。

- **收藏資料集**：使用者可收藏經常使用的資料集，方便在後台快速尋找。

- **資料統計**：資料集會針對標註的標籤、影像時間、驗證認同率、貢獻排行榜生成統計圖，方便使用者掌握資料集狀態。若資料集有收集位置資訊，則另外會有統計地圖供使用者查看。

- **打包下載**：依據資料集標註格式不同將資料集打包成不同格式下載，若為整張標註，則依標籤將影像分在不同資料夾並壓縮成zip下載；若為框選標註，則將影像放在image資料夾，標註放在annotation資料夾(存成voc格式)，並壓縮成zip下載。

- **編輯使用者資料**：可修改使用者顯示名稱及頭像縮圖。

## 資料集版主功能
- **編輯資料集**: 被設為資料集版主的使用者可以擁有管理該資料集的權限，包括設定資集封面、影像最大解析度、是否公開(未公開資料集可設定哪些使用者能看)、是否開放上傳影像、是否開放打包下載、是否儲存位置資訊、是否開放標註、可標註的標籤、私密成員、版主等，以及刪除該資料集影像、標註等權限。

## 管理員功能
- **新增、刪除、編輯資料集**：管理員除了對所有資料集都有編輯權限，還可新增、刪除資料集。

- **設定、取消管理員**：一般使用者只能使用一般功能，管理員除了一般功能還能使用管理員功能。

- **設定、取消黑名單**：黑名單使用者將無法使用上傳、標註、驗證影像，與打包下載功能。

- **新增、刪除API金鑰**：API金鑰用來讓程式上傳影像及標註，可搭配無人載具用來收集場域資料或是用程式將整個資料集上傳至server。

<p align="center">
<img width=200 height=150 alt="土砲1號" src="https://raw.githubusercontent.com/aga3134/CommuTag/master/photo/topower_v1.jpg"> <img width=200 height=150 alt="mini farmbot" src="https://raw.githubusercontent.com/aga3134/CommuTag/master/photo/minifarmbot.jpg"> <img width=200 height=150 alt="無人機" src="https://raw.githubusercontent.com/aga3134/CommuTag/master/photo/drone.jpg">
</p>

## API上傳
要使用API上傳影像時需先請管理員在後台新增並提供API金鑰。

### 上傳影像
使用時用 http POST 到網址 **{{你的伺服器網址}}/api/upload-image**

POST資料包括下列欄位:
- dataset: 資料集id，當你點選資料集進入觀看影像時會顯示在網址列
- lat: 影像位置的緯度，若資料集不接受位置資訊就無需傳輸此欄位
- lng: 影像位置的經度，若資料集不接受位置資訊就無需傳輸此欄位
- remark: 影像的備註
- dataTime: 取得影像的時間
- apiKey: 跟管理員拿到的api key

上傳範列請見 **python/apiUpload/apiUpload.py**

### 上傳標註
使用時用 http POST 到網址 **{{你的伺服器網址}}/api/set-annotation**

POST資料包括下列欄位:
- dataset: 資料集id，當你點選資料集進入觀看影像時會顯示在網址列
- image: 要標註的影像id
- annotation: 影像標註資訊
- apiKey: 跟管理員拿到的api key

上傳範列請見 **python/batchUpload/** 中的程式

### 上傳整個資料集的影像及標註
- 本專案網站UI的使用情境比較像是場域調查，使用者或無人載具固定時間在場域裡面調查拍照，然後就一邊上傳。之後資料集就由社群一起標註。如果要一次上傳自己電腦裡整個資料集的影像跟標註，請使用api的方式上傳。
- 資料集上傳範例請見 **python/batchUpload/** 中的程式
- 其中**batchUpload.py**為主程式，會呼叫 **batchUploadAnnotateImage.py** 和 **batchUploadAnnotateBBox.py** 中的function，而 **batchUploadAnnotateImage.py** 和 **batchUploadAnnotateBBox.py** 是繼承 **batchUploadAnnotateBase.py**
- 使用時將 **batchUpload.py** 中的參數跟資料夾位置修改之後執行，即可上傳資料集與標註 (程式內有各參數說明的註解)。

## 安裝架設
### 程式架構
- 前端：Vue 2.7 + Quasar 1，用 Vite 打包（`npm run build` 產生 `dist/`）
- 後端：Node.js 22 + Express 4
- 資料庫：MongoDB 7（Mongoose 8）。所有照片的資料存在同一個 `image` collection，位置存成 GeoJSON 並建 2dsphere 索引
- 照片儲存：相容 S3 的物件儲存。正式環境用 Cloudflare R2，開發時用本機的 S3 替身
- 照片網址一律是 `/media/...`：伺服器先檢查權限（私有資料集只有成員看得到），再轉到有效期 10 分鐘的簽名網址。bucket 本身不公開
- 打包下載：由 Node 直接從儲存空間串流產生 zip，伺服器不需要 Python

### 正式環境（Docker）
1. 安裝 Docker 與 Docker Compose
2. `git clone` 本專案，把 `config-template.json` 複製成 `config.json` 並填好（見下方 config 設定）。`mode` 設為 `production`
3. 在 Cloudflare R2 建一個 bucket（保持私有），並建立有該 bucket 讀寫權限的 API token，填進 `config.json` 的 `storage`
4. `docker compose up -d --build`
5. 網站只在本機 `127.0.0.1:8001` 開放，前面要接反向代理或 Cloudflare Tunnel 提供 HTTPS。正式模式的登入 cookie 只在 HTTPS 下有效
6. 設定每日備份（見下方「資料庫備份」）

MongoDB 沒有對外開放 port，只有網站程式連得到。

### 資料庫備份
`scripts/backup-mongo.sh` 會把資料庫 dump 後存進同一個 bucket 的 `backup/` 底下，預設保留最新 30 份（環境變數 `BACKUP_KEEP` 可改）。`/media` 不會提供 `backup/` 底下的檔案。

```
# crontab：每天 03:15 備份
15 3 * * * cd /srv/commutag && ./scripts/backup-mongo.sh >> log/backup.log 2>&1
```

還原：從 bucket 下載 `backup/mongo-<時間>.archive.gz`，然後
`docker compose exec -T mongo mongorestore --archive --gzip --drop < mongo-<時間>.archive.gz`

照片本身存在 R2，不在這份備份裡。

### 本機開發
1. `docker compose -f docker-compose.dev.yml up -d`（啟動 MongoDB 與 S3 替身）
2. 複製 `config-template.json` 成 `config.json`，`mode` 設 `development`，並照 `docker-compose.dev.yml` 開頭的註解填 `mongodb.url` 與 `storage`
3. `npm install`
4. `npm run build-watch`（前端）與 `npm run start-watch`（後端），開啟 http://localhost:8001

### 測試
需要上面的開發用 MongoDB 與 S3 替身。先 `npm run build`（頁面測試會讀 Vite 的 manifest），再 `npm test`。

## config設定
**config中含有機密資訊，請勿將其對外公開。**
架設專案時請將config-template.json複製一份成config.json，並修改裡面的內容。各欄位說明如下：

- mode: 可為development或production，設為development時錯誤會有較多debug資訊，但相對速度較慢，上線使用時請設為production。

- mongodb: mongodb連線資訊
    - url: mongodb連線位置。
        - 用 docker-compose.yml 部署時請設為 mongodb://mongo:27017/commutag
        - 本機開發請設為 mongodb://127.0.0.1:27019/commutag
        
- facebookAuth: 以facebook帳號登入的功能設定，要使用需先[取得facebook開發者金鑰](https://www.techcoke.com/2014/05/register-facebook-application-api-key-app-id.html)
    - enable: 若不使用facebook登入功能可設為false關閉，反之設true
    - clientID: 你申請取得的應用程式ID
    - clientSecret: 你申請取得的應用程式密鑰
    - callbackURL: 使用者登入成功後返回的網址，需設定為 {{你的伺服器網址}}/auth/facebook/callback
    
- googleAuth: 以google帳號登入的功能設定，要使用需先[取得google開發者金鑰](https://blog.gtwang.org/programming/obtaining-api-key-from-google-developers-console/)
    - enable: 若不使用google登入功能可設為false關閉，反之設true
    - clientID: 你申請取得的應用程式ID
    - clientSecret: 你申請取得的應用程式密鑰
    - callbackURL: 使用者登入成功後返回的網址，需設定為 {{你的伺服器網址}}/auth/google/callback
    
- email: 寄信設定（註冊確認信、忘記密碼信），走 SMTP，任何寄信服務都可以用
    - enable: 不寄信時設為 false
    - sender: 寄件人 email
    - smtp: host、port、secure（465 用 true，587 用 false）、user、pass

- storage: 照片的物件儲存（相容 S3）
    - endpoint: R2 為 `https://<帳號 ID>.r2.cloudflarestorage.com`；本機開發見 `docker-compose.dev.yml`
    - region: R2 填 `auto`
    - bucket: bucket 名稱（請保持私有）
    - accessKeyId、secretAccessKey: 有該 bucket 讀寫權限的 API token
    - forcePathStyle: R2 填 false；本機的 S3 替身填 true

- session: 用來記住使用者的登入資訊
    - secret: session加密金鑰，可隨意輸入字串
    
- jwt: 重設密碼時用來驗證修改權限
    - secret: jwt加密金鑰，可隨意輸入字串
    
- hostname: 你的伺服器網址

- siteName: 顯示出來的網站名稱

- desc: 分享網站網址時顯示出來的簡介

- logo: 取代網站的logo，把影像複製進 static/image 資料夾裡，並把檔名寫在這邊即可

- serverPort: 程式使用的port，若設為8001則在本機可用 http://localhost:8001 看到網站

- version: 程式版本

- defaultAdmin: 預設的管理員帳號
    - provider: 可為google、facebook、local 分別對應到gooele帳號登入、facebook帳號登入、密碼登入
    - email: 管理員帳號的email
    
- verify: 標註驗證時判斷是否驗證完成的條件設定
    - sample: 至少需有幾人驗證
    - accept: 驗證人數超過sample且認同率大於此值時視為驗證完成 (值為0~1)
    - reject: 驗證人數超過sample且認同率小於此值時視為不合格的標註，需重新標註 (值為0~1)

