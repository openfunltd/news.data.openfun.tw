# OpenFun Data News

歐噴資料庫近期新增資料的公開網站，包含最新一期摘要、歐噴餐廳美食街與依年份、月份整理的歷期內容。

網站為純靜態檔案，GitHub Pages 發布目錄為 `docs/`。

## 歐噴餐廳美食街

餐廳目錄資料存放在 `data/restaurants.json`。只有建立含有新餐廳的週報時，才從該期週報增量寫入；不會重新掃描所有歷史週報。

在新週報加上以下語意標記：

- `data-restaurant-catalog-intro`：要帶到美食街的介紹文字
- `data-restaurant`：整個餐廳區塊
- `data-restaurant-name`：餐廳名稱
- `data-restaurant-category`：資料主題
- `data-restaurant-summary`：一句話介紹
- `data-restaurant-link`：餐廳外部連結
- `data-restaurant-tags`：包住特色標籤的容器；每個標籤使用 `span`
- `data-restaurant-image`：該餐廳在週報內的實際網站截圖

完成週報後執行：

```sh
node scripts/update-restaurant-catalog.mjs --issue YYYY-MM-DD
```

程式只讀取指定期數，把新餐廳寫入 `data/restaurants.json`，並以網址去重、保留首次登場日期；之後再由這份目錄資料重建首頁。若只修改版面或目錄資料，可直接重建首頁：

```sh
node scripts/update-restaurant-catalog.mjs
```

驗證首頁是否已與目錄資料同步：

```sh
node scripts/update-restaurant-catalog.mjs --check
```
