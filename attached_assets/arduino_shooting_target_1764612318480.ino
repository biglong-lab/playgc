/**
 * 賈村競技體驗場 - Arduino ESP32 射擊靶機控制程式
 * 
 * 功能:
 * - WiFi 連線
 * - MQTT 通訊
 * - 紅外線感應器檢測射擊
 * - LED 指示燈控制
 * - 心跳機制
 * - 自動重連
 * 
 * 硬體需求:
 * - ESP32 開發板
 * - 紅外線感應器 (連接 GPIO 34)
 * - RGB LED (連接 GPIO 25, 26, 27)
 * - 蜂鳴器 (連接 GPIO 32)
 * 
 * 作者: Manus AI
 * 版本: 1.0.0
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

// ==================== 設定區 ====================

// WiFi 設定
const char* WIFI_SSID = "YOUR_WIFI_SSID";           // 修改為您的 WiFi 名稱
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // 修改為您的 WiFi 密碼

// MQTT 設定
const char* MQTT_BROKER = "xxxxxxxx.s1.eu.hivemq.cloud";  // 修改為您的 HiveMQ Broker URL
const int MQTT_PORT = 8883;                                // TLS 加密端口
const char* MQTT_USERNAME = "your_username";               // 修改為您的 MQTT 使用者名稱
const char* MQTT_PASSWORD = "your_password";               // 修改為您的 MQTT 密碼

// 設備設定
const char* DEVICE_ID = "TARGET_001";  // 每個設備必須有唯一的 ID
const char* DEVICE_NAME = "射擊靶機 #1";
const char* FIRMWARE_VERSION = "1.0.0";

// GPIO 腳位定義
const int IR_SENSOR_PIN = 34;      // 紅外線感應器 (輸入)
const int LED_RED_PIN = 25;        // 紅色 LED
const int LED_GREEN_PIN = 26;      // 綠色 LED
const int LED_BLUE_PIN = 27;       // 藍色 LED
const int BUZZER_PIN = 32;         // 蜂鳴器

// 時間設定 (毫秒)
const unsigned long HEARTBEAT_INTERVAL = 30000;  // 心跳間隔 30 秒
const unsigned long RECONNECT_INTERVAL = 5000;   // 重連間隔 5 秒
const unsigned long DEBOUNCE_DELAY = 200;        // 防彈跳延遲 200ms

// ==================== 全域變數 ====================

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// MQTT Topics
String topicStatus;
String topicHeartbeat;
String topicHit;
String topicControl;
String topicConfig;
String topicLed;

// 狀態變數
bool isGameActive = false;
int currentGameId = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastHitTime = 0;
int hitCount = 0;
int totalScore = 0;

// LED 狀態
struct LEDState {
  int red = 0;
  int green = 0;
  int blue = 0;
  String mode = "solid";  // solid, blink, pulse
  unsigned long lastBlink = 0;
  bool blinkState = false;
};
LEDState ledState;

// ==================== 初始化函數 ====================

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("賈村競技體驗場 - 射擊靶機系統");
  Serial.println("=================================");
  Serial.printf("設備 ID: %s\n", DEVICE_ID);
  Serial.printf("設備名稱: %s\n", DEVICE_NAME);
  Serial.printf("韌體版本: %s\n\n", FIRMWARE_VERSION);
  
  // 初始化 GPIO
  pinMode(IR_SENSOR_PIN, INPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_BLUE_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // 初始化 LED 為關閉
  setLED(0, 0, 0);
  
  // 初始化 Watchdog Timer (60秒)
  esp_task_wdt_init(60, true);
  esp_task_wdt_add(NULL);
  
  // 建立 MQTT Topics
  topicStatus = "jiachun/devices/" + String(DEVICE_ID) + "/status";
  topicHeartbeat = "jiachun/devices/" + String(DEVICE_ID) + "/heartbeat";
  topicHit = "jiachun/devices/" + String(DEVICE_ID) + "/hit";
  topicControl = "jiachun/devices/" + String(DEVICE_ID) + "/control";
  topicConfig = "jiachun/devices/" + String(DEVICE_ID) + "/config";
  topicLed = "jiachun/devices/" + String(DEVICE_ID) + "/led";
  
  // 連線 WiFi
  connectWiFi();
  
  // 設定 MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);
  
  // 連線 MQTT
  connectMQTT();
  
  // 啟動完成,閃爍綠燈
  blinkLED(0, 255, 0, 3);
  playTone(1000, 200);
  
  Serial.println("系統啟動完成!\n");
}

// ==================== 主迴圈 ====================

void loop() {
  // 重置 Watchdog
  esp_task_wdt_reset();
  
  // 檢查 WiFi 連線
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi 斷線,重新連線...");
    connectWiFi();
  }
  
  // 檢查 MQTT 連線
  if (!mqttClient.connected()) {
    Serial.println("MQTT 斷線,重新連線...");
    connectMQTT();
  }
  
  // 處理 MQTT 訊息
  mqttClient.loop();
  
  // 發送心跳
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // 檢測射擊
  if (isGameActive) {
    checkShootingHit();
  }
  
  // 更新 LED 狀態
  updateLED();
  
  delay(10);
}

// ==================== WiFi 連線 ====================

void connectWiFi() {
  Serial.printf("連線 WiFi: %s\n", WIFI_SSID);
  setLED(255, 255, 0);  // 黃燈表示連線中
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi 連線成功!");
    Serial.printf("IP 位址: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("訊號強度: %d dBm\n", WiFi.RSSI());
    setLED(0, 255, 0);  // 綠燈表示成功
    delay(1000);
  } else {
    Serial.println("\nWiFi 連線失敗!");
    setLED(255, 0, 0);  // 紅燈表示失敗
    delay(5000);
    ESP.restart();  // 重啟設備
  }
}

// ==================== MQTT 連線 ====================

void connectMQTT() {
  Serial.printf("連線 MQTT Broker: %s:%d\n", MQTT_BROKER, MQTT_PORT);
  setLED(0, 255, 255);  // 青燈表示連線中
  
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 5) {
    Serial.printf("嘗試連線 MQTT (第 %d 次)...\n", attempts + 1);
    
    // 建立唯一的 Client ID
    String clientId = "ESP32_" + String(DEVICE_ID) + "_" + String(random(0xffff), HEX);
    
    // 連線 MQTT (使用 TLS 需要額外設定憑證,這裡簡化處理)
    if (mqttClient.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println("MQTT 連線成功!");
      
      // 訂閱控制 Topics
      mqttClient.subscribe(topicControl.c_str());
      mqttClient.subscribe(topicConfig.c_str());
      mqttClient.subscribe(topicLed.c_str());
      
      Serial.printf("已訂閱: %s\n", topicControl.c_str());
      Serial.printf("已訂閱: %s\n", topicConfig.c_str());
      Serial.printf("已訂閱: %s\n", topicLed.c_str());
      
      // 發送上線狀態
      sendStatus("online");
      
      setLED(0, 255, 0);  // 綠燈表示成功
      delay(1000);
      setLED(0, 0, 255);  // 藍燈表示待機
      
      return;
    } else {
      Serial.printf("MQTT 連線失敗,錯誤碼: %d\n", mqttClient.state());
      setLED(255, 0, 0);  // 紅燈表示失敗
      delay(RECONNECT_INTERVAL);
    }
    
    attempts++;
  }
  
  if (!mqttClient.connected()) {
    Serial.println("MQTT 連線失敗,重啟設備...");
    delay(5000);
    ESP.restart();
  }
}

// ==================== MQTT 訊息處理 ====================

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("\n收到 MQTT 訊息 [%s]: ", topic);
  
  // 轉換 payload 為字串
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // 解析 JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) {
    Serial.printf("JSON 解析失敗: %s\n", error.c_str());
    return;
  }
  
  // 處理控制指令
  if (String(topic) == topicControl) {
    handleControlCommand(doc);
  }
  // 處理設定更新
  else if (String(topic) == topicConfig) {
    handleConfigUpdate(doc);
  }
  // 處理 LED 控制
  else if (String(topic) == topicLed) {
    handleLEDControl(doc);
  }
}

// 處理控制指令
void handleControlCommand(JsonDocument& doc) {
  String command = doc["command"] | "";
  
  if (command == "start") {
    // 開始遊戲
    currentGameId = doc["game_id"] | 0;
    isGameActive = true;
    hitCount = 0;
    totalScore = 0;
    
    Serial.printf("遊戲開始! Game ID: %d\n", currentGameId);
    setLED(0, 255, 0);  // 綠燈表示遊戲進行中
    playTone(1500, 100);
    
  } else if (command == "stop") {
    // 停止遊戲
    isGameActive = false;
    
    Serial.println("遊戲結束!");
    Serial.printf("總命中數: %d, 總分數: %d\n", hitCount, totalScore);
    setLED(0, 0, 255);  // 藍燈表示待機
    playTone(1000, 100);
    
  } else if (command == "reset") {
    // 重置設備
    Serial.println("重置設備...");
    sendStatus("resetting");
    delay(1000);
    ESP.restart();
    
  } else if (command == "test") {
    // 測試模式
    Serial.println("進入測試模式");
    testDevice();
  }
}

// 處理設定更新
void handleConfigUpdate(JsonDocument& doc) {
  Serial.println("更新設定...");
  
  // 這裡可以新增更多設定項目
  // 例如: 難度、計分規則、感應器靈敏度等
  
  sendStatus("config_updated");
}

// 處理 LED 控制
void handleLEDControl(JsonDocument& doc) {
  String color = doc["color"] | "blue";
  String mode = doc["mode"] | "solid";
  
  ledState.mode = mode;
  
  if (color == "red") {
    ledState.red = 255; ledState.green = 0; ledState.blue = 0;
  } else if (color == "green") {
    ledState.red = 0; ledState.green = 255; ledState.blue = 0;
  } else if (color == "blue") {
    ledState.red = 0; ledState.green = 0; ledState.blue = 255;
  } else if (color == "yellow") {
    ledState.red = 255; ledState.green = 255; ledState.blue = 0;
  } else if (color == "purple") {
    ledState.red = 255; ledState.green = 0; ledState.blue = 255;
  } else if (color == "cyan") {
    ledState.red = 0; ledState.green = 255; ledState.blue = 255;
  } else if (color == "white") {
    ledState.red = 255; ledState.green = 255; ledState.blue = 255;
  } else if (color == "off") {
    ledState.red = 0; ledState.green = 0; ledState.blue = 0;
  }
  
  Serial.printf("LED 設定: 顏色=%s, 模式=%s\n", color.c_str(), mode.c_str());
}

// ==================== 射擊檢測 ====================

void checkShootingHit() {
  int sensorValue = digitalRead(IR_SENSOR_PIN);
  
  // 檢測到射擊 (低電位觸發)
  if (sensorValue == LOW) {
    // 防彈跳處理
    if (millis() - lastHitTime > DEBOUNCE_DELAY) {
      lastHitTime = millis();
      hitCount++;
      
      // 計算分數 (這裡簡化處理,實際可根據命中位置計算)
      int score = random(5, 11);  // 隨機 5-10 分
      totalScore += score;
      
      Serial.printf("射擊命中! 第 %d 發, 得分: %d, 總分: %d\n", hitCount, score, totalScore);
      
      // 發送命中事件
      sendHitEvent(score);
      
      // 視覺與聽覺回饋
      blinkLED(255, 255, 0, 1);  // 黃燈閃爍
      playTone(2000, 100);
    }
  }
}

// ==================== MQTT 發送函數 ====================

// 發送狀態
void sendStatus(String status) {
  StaticJsonDocument<256> doc;
  doc["status"] = status;
  doc["device_id"] = DEVICE_ID;
  doc["device_name"] = DEVICE_NAME;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;
  
  String output;
  serializeJson(doc, output);
  
  mqttClient.publish(topicStatus.c_str(), output.c_str());
  Serial.printf("發送狀態: %s\n", status.c_str());
}

// 發送心跳
void sendHeartbeat() {
  StaticJsonDocument<128> doc;
  doc["timestamp"] = millis();
  doc["uptime"] = millis() / 1000;
  doc["rssi"] = WiFi.RSSI();
  doc["free_heap"] = ESP.getFreeHeap();
  
  String output;
  serializeJson(doc, output);
  
  mqttClient.publish(topicHeartbeat.c_str(), output.c_str());
  Serial.println("發送心跳 ♥");
}

// 發送命中事件
void sendHitEvent(int score) {
  StaticJsonDocument<256> doc;
  doc["game_id"] = currentGameId;
  doc["device_id"] = DEVICE_ID;
  doc["hit_count"] = hitCount;
  doc["score"] = score;
  doc["total_score"] = totalScore;
  doc["timestamp"] = millis();
  
  String output;
  serializeJson(doc, output);
  
  mqttClient.publish(topicHit.c_str(), output.c_str());
}

// ==================== LED 控制 ====================

void setLED(int red, int green, int blue) {
  analogWrite(LED_RED_PIN, red);
  analogWrite(LED_GREEN_PIN, green);
  analogWrite(LED_BLUE_PIN, blue);
}

void updateLED() {
  if (ledState.mode == "solid") {
    setLED(ledState.red, ledState.green, ledState.blue);
  } 
  else if (ledState.mode == "blink") {
    if (millis() - ledState.lastBlink > 500) {
      ledState.blinkState = !ledState.blinkState;
      ledState.lastBlink = millis();
      
      if (ledState.blinkState) {
        setLED(ledState.red, ledState.green, ledState.blue);
      } else {
        setLED(0, 0, 0);
      }
    }
  }
  else if (ledState.mode == "pulse") {
    // 呼吸燈效果 (簡化版)
    int brightness = (sin(millis() / 500.0) + 1) * 127;
    setLED(
      ledState.red * brightness / 255,
      ledState.green * brightness / 255,
      ledState.blue * brightness / 255
    );
  }
}

void blinkLED(int red, int green, int blue, int times) {
  for (int i = 0; i < times; i++) {
    setLED(red, green, blue);
    delay(200);
    setLED(0, 0, 0);
    delay(200);
  }
}

// ==================== 蜂鳴器控制 ====================

void playTone(int frequency, int duration) {
  tone(BUZZER_PIN, frequency, duration);
}

// ==================== 測試函數 ====================

void testDevice() {
  Serial.println("\n=== 設備測試開始 ===");
  
  // 測試 LED
  Serial.println("測試 LED...");
  setLED(255, 0, 0); delay(500);
  setLED(0, 255, 0); delay(500);
  setLED(0, 0, 255); delay(500);
  setLED(0, 0, 0);
  
  // 測試蜂鳴器
  Serial.println("測試蜂鳴器...");
  playTone(1000, 200); delay(300);
  playTone(1500, 200); delay(300);
  playTone(2000, 200); delay(300);
  
  // 測試感應器
  Serial.println("測試感應器 (請在 5 秒內觸發)...");
  unsigned long testStart = millis();
  bool detected = false;
  while (millis() - testStart < 5000) {
    if (digitalRead(IR_SENSOR_PIN) == LOW) {
      Serial.println("感應器觸發!");
      blinkLED(0, 255, 0, 2);
      detected = true;
      break;
    }
    delay(100);
  }
  if (!detected) {
    Serial.println("未檢測到觸發");
  }
  
  Serial.println("=== 設備測試完成 ===\n");
  sendStatus("test_completed");
}
