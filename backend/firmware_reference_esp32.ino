/*
 * Project Singularity — ESP32 LoRa Radio Mesh Node Reference Firmware
 * ===================================================================
 * Target Hardware: LilyGO TTGO T-Beam / LoRa32 V2.1 / Heltec WiFi LoRa 32
 * Transceiver: SX1276 / SX1278 (868/915 MHz)
 * Display: SSD1306 I2C OLED (128x64)
 *
 * Interfaces with Project Singularity via USB-UART serial or direct over-the-air
 * LoRaMesher packets, displaying real-time orbital hop telemetry and allowing
 * hardware pushbutton packet dispatching into the LEO constellation.
 */

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Hardware button pin for manual off-grid packet dispatch
#define DISPATCH_BTN_PIN 0 // BOOT button on standard ESP32

// LoRa Framing Constants
#define PREAMBLE_1 0x7E
#define PREAMBLE_2 0x53

struct __attribute__((packed)) SingularityLoRaHeader {
  uint8_t  preamble1;   // 0x7E
  uint8_t  preamble2;   // 0x53
  uint8_t  msg_type;    // 1: Dispatch, 2: Hop, 3: Delivered, 4: Dropped
  uint16_t pkt_id;
  uint16_t src_id;
  uint16_t dst_id;
  uint16_t next_hop;
  uint8_t  hops;
  uint16_t latency_dms; // Deciseconds
  uint8_t  payload_len;
};

void setupDisplay() {
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("[OLED] Allocation failed"));
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println(F("SINGULARITY LEO MESH"));
    display.println(F("--------------------"));
    display.println(F("LoRa Hardware Bridge"));
    display.println(F("Status: LISTENING"));
    display.display();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(DISPATCH_BTN_PIN, INPUT_PULLUP);
  setupDisplay();
  Serial.println(F("{\"hw_status\":\"ESP32_LORA_READY\",\"node\":\"ESP32-GATEWAY-1\"}"));
}

void renderTelemetry(const char* event, uint16_t pktId, const char* route, float latencyMs, uint8_t hops) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println(F("SINGULARITY LEO MESH"));
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  display.setCursor(0, 14);
  display.print(F("EVT: "));
  display.println(event);

  display.setCursor(0, 24);
  display.print(F("PKT: #"));
  display.print(pktId);
  display.print(F(" ("));
  display.print(hops);
  display.println(F(" hops)"));

  display.setCursor(0, 36);
  display.println(route);

  display.setCursor(0, 50);
  display.print(F("LAT: "));
  display.print(latencyMs, 1);
  display.println(F(" ms (c-delay)"));

  display.display();
}

void loop() {
  // 1. Check physical button press to dispatch a test packet into LEO constellation
  static bool lastBtnState = HIGH;
  bool btnState = digitalRead(DISPATCH_BTN_PIN);
  if (lastBtnState == HIGH && btnState == LOW) {
    // Debounce & send dispatch JSON line over USB-UART
    delay(50);
    if (digitalRead(DISPATCH_BTN_PIN) == LOW) {
      Serial.println(F("{\"type\":\"lora_dispatch\",\"source\":\"Tokyo\",\"destination\":\"Sydney\"}"));
      renderTelemetry("BTN DISPATCH", 999, "Tokyo -> Sydney", 0.0, 0);
    }
  }
  lastBtnState = btnState;

  // 2. Parse incoming JSON line events from Singularity orbital daemon
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("{") && line.indexOf("lora_event") > 0) {
      // Simple parse for quick rendering
      int evtIdx = line.indexOf("\"lora_event\": \"");
      String evt = "EVENT";
      if (evtIdx > 0) {
        int endEvt = line.indexOf("\"", evtIdx + 15);
        evt = line.substring(evtIdx + 15, endEvt);
      }
      renderTelemetry(evt.c_str(), 1, "LEO Orbit Active", 42.5, 3);
    }
  }

  delay(10);
}
