// 🏠 CHITO 平台首頁（根路由 /）
//
// 永遠顯示 CHITO 品牌 + 場域列表（FieldEntry）
// 回訪玩家會在 FieldEntry 內看到「繼續上次場域」的快捷卡片，但不強制跳轉
//
// 不再做自動 redirect：使用者明確看到 CHITO 平台定位，再自己選擇要進哪個場域
import FieldEntry from "./FieldEntry";

export default function PlatformHome() {
  return <FieldEntry />;
}
