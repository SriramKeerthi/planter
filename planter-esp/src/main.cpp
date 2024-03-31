#include <Arduino.h>
#include <ArduinoWebsockets.h>
#include <WiFi.h>
#include <SPI.h>
#include <FS.h>
#include "SPIFFS.h"
#include <TFT_eSPI.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <FastLED_RGBW.h>
#include "pitches.h"
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ElegantOTA.h>
#include "config.h"

extern "C"
{
#include "libb64/cdecode.h"
}

#define SCREEN_BL_CHANNEL 0

#define NUM_LEDS 4
#define ADDR_LED_PIN 27

#define LDR_PIN 36
#define TOUCH1_PIN 32
#define TOUCH2_PIN 33

#define REF_PIN 2
#define VBAT_PIN 34

#define BUZZER_PIN 12

TaskHandle_t core2Task;
void loop2();
void core2TaskFunction(void *pvParameters)
{
  for (;;)
    loop2();
}

TFT_eSPI tft = TFT_eSPI();
AsyncWebServer server(80);

CRGBW leds[NUM_LEDS];
CRGB *ledsRGB = (CRGB *)&leds[0];

const char *ssid = WIFI_SSID;
const char *password = WIFI_PASS;

using namespace websockets;

WebsocketsClient client;

void drawImage();
void displayMessage(const char *message);

const int screenTime = 15000;
const int imageSize = 510;
const int maxImages = 4;
char imageBuffer[(imageSize + 10) * maxImages];
int imageCount = 0;
int imageRefresh = 500;
unsigned long lastImageTime = 0;
int lastImageIndex = -1;
bool displayOn = true;
unsigned long lastMessage = 0;
bool offlineMode = false;
bool lights = false;
bool sounds = false;
int tftBrightness = 128;
int ledBrightness = 128;

int melody[] = {
    NOTE_C4, NOTE_G3, NOTE_G3, NOTE_A3, NOTE_G3, 0, NOTE_B3, NOTE_C4};

int noteDurations[] = {
    4, 8, 8, 4, 4, 4, 4, 4};

void toggleDisplay(bool);

void colorFill(CRGB c);

void fillWhite();

void rainbow();

void rainbowLoop();

unsigned long ota_progress_millis = 0;

void onOTAStart()
{
  // Log when OTA has started
  Serial.println("OTA update started!");
  // <Add your own code here>
}

void onOTAProgress(size_t current, size_t final)
{
  // Log every 1 second
  if (millis() - ota_progress_millis > 1000)
  {
    ota_progress_millis = millis();
    Serial.printf("OTA Progress Current: %u bytes, Final: %u bytes\n", current, final);
  }
}

void onOTAEnd(bool success)
{
  // Log when OTA has finished
  if (success)
  {
    Serial.println("OTA update finished successfully!");
  }
  else
  {
    Serial.println("There was an error during OTA update!");
  }
  // <Add your own code here>
}

void setup()
{
  Serial.begin(115200);

  unsigned long startTime = millis();
  while (!Serial)
  {
    if (millis() - startTime > 5000)
    {
      break;
    }
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(1000);
    Serial.println("Connecting to WiFi...");
    if (millis() - startTime > 10000)
    {
      break;
    }
  }
  Serial.println("Connected to WiFi");

  client.addHeader("Authorization", "Basic c3JpcmFtOnBhc3N3b3Jk");
  startTime = millis();
  while (!client.connect("ws://192.168.1.67:3000/ws"))
  {
    if (millis() - startTime > 5000)
    {
      break;
    }
    delay(1000);
  }
  if (!client.available())
  {
    Serial.println("Failed to connect to websocket server");
    // ESP.restart();
    offlineMode = true;
    base64_decode_chars("MTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAxMTAwMDAxMTAwMDAwMDAwMDAxMTAwMDAwMDAwMDEwMDEwMDEwMDEwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDEwMDAwMDAwMDEwMDAwMDAwMDAxMTAwMDAwMDAwMDAxMTExMTExMTAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAxMTAwMDAxMTAwMDAwMDAwMDAxMTAwMDAwMDAwMDEwMDEwMDEwMDEwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDExMTExMTExMTEwMDAwMDAwMDAxMTAwMDAwMDAwMDAxMDAwMDAwMTAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMTExMTExMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxMTExMTExMTExMTExMTExMTExMTExMTExMTExMTEx", 1360, imageBuffer);
    imageCount = 2;
    imageRefresh = 1000;
  }
  else
  {

    client.onMessage([](WebsocketsMessage message)
                     {
    DynamicJsonDocument doc(2048*3/2);
    deserializeJson(doc, message.data());
    JsonObject obj = doc.as<JsonObject>();

    // Now you can access values in the JSON object, for example:
    const char *event = obj["event"];

    Serial.println("Received event: " + String(event));
    client.send("{\"event\":\"ack\",\"data\":{\"message\":\"" + String(event) + " received\"}}");
    if (strcmp(event, "message") == 0)
    {
      Serial.println("Received message event");
      displayMessage(obj["data"]["message"]);
    } else if (strcmp(event, "image") == 0) {
      Serial.println("Received image event");
      imageCount = obj["data"]["ic"];
      imageRefresh = obj["data"]["ir"];
      lastImageIndex = -1;
      lastImageTime = millis() - imageRefresh;
      base64_decode_chars(obj["data"]["image"], message.length(), imageBuffer);
      toggleDisplay(true);
    } else if (strcmp(event, "config") == 0) {
      Serial.println("Received config event");
      lights = obj["data"]["lights"];
      sounds = obj["data"]["sounds"];
      tftBrightness = obj["data"]["tftBrightness"];
      ledBrightness = obj["data"]["ledBrightness"];
      toggleDisplay(obj["data"]["state"]);
    } else if (strcmp(event, "restart") == 0) {
      Serial.println("Received restart event");
      ESP.restart();
    } });

    client.onEvent([](WebsocketsEvent event, String data)
                   {
    if (event == WebsocketsEvent::ConnectionClosed) {
      Serial.println("Connection closed");
      ESP.restart();
    } });
    Serial.println("Connected to websocket server");
  }

  pinMode(REF_PIN, OUTPUT);
  pinMode(VBAT_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TOUCH1_PIN, INPUT);

  pinMode(TFT_BL, OUTPUT);

  ledcSetup(0, 5000, 8);
  ledcAttachPin(TFT_BL, 0);
  ledcWrite(0, 0);

  tft.init();
  tft.fillScreen(TFT_NAVY);
  tft.setRotation(1);
  tft.setTextSize(2);
  tft.setTextColor(TFT_WHITE);
  tft.println("Hello there!");

  FastLED.addLeds<WS2812B, ADDR_LED_PIN, RGB>(ledsRGB, getRGBWsize(NUM_LEDS));
  FastLED.setBrightness(128);
  FastLED.show();

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(200, "text/plain", "Hi! This is ElegantOTA AsyncDemo."); });

  ElegantOTA.begin(&server); // Start ElegantOTA
  // ElegantOTA callbacks
  ElegantOTA.onStart(onOTAStart);
  ElegantOTA.onProgress(onOTAProgress);
  ElegantOTA.onEnd(onOTAEnd);

  server.begin();
  Serial.println("HTTP server started");

  xTaskCreatePinnedToCore(
      core2TaskFunction,
      "Core2",
      10000,
      NULL,
      0,
      &core2Task,
      0);
}

void loop()
{
  ElegantOTA.loop();
  if (!offlineMode)
  {
    client.poll();
    if (displayOn)
    {
      if (millis() - lastMessage > offlineMode)
      {
        toggleDisplay(false);
      }
      else
      {
        drawImage();
      }
    }
    delay(1);
  }
  else
  {
    // float VBAT = (float)(analogRead(VBAT_PIN)) * 3600 / 4095 * 2;
    // Serial.println("Vbat = ");
    // Serial.print(VBAT);
    // Serial.println(" Volts");
    // digitalWrite(REF_PIN, 0);
    // delay(2000);
    // Serial.println("Vbat2 = ");
    // VBAT = (float)(analogRead(VBAT_PIN)) * 3600 / 4095 * 2;
    // Serial.print(VBAT);
    // Serial.println(" Volts");
    // digitalWrite(REF_PIN, 1);

    Serial.print("Touch1: ");
    Serial.println(touchRead(TOUCH1_PIN));
    Serial.print("Touch2: ");
    Serial.println(touchRead(TOUCH2_PIN));

    Serial.println(analogRead(LDR_PIN));

    if (sounds)
    {
      for (int thisNote = 0; thisNote < 8; thisNote++)
      {
        int noteDuration = 1000 / noteDurations[thisNote];
        tone(BUZZER_PIN, melody[thisNote], noteDuration);

        int pauseBetweenNotes = noteDuration * 1.30;
        delay(pauseBetweenNotes);
        noTone(BUZZER_PIN);
      }
    }

    drawImage();
    delay(50);
  }
}

void loop2()
{
  if (lights)
  {
    FastLED.setBrightness(ledBrightness);

    // colorFill(CRGB::Red);
    // colorFill(CRGB::Green);
    // colorFill(CRGB::Blue);
    // fillWhite();
    rainbowLoop();
    delay(50);
  }
  else
  {
    FastLED.setBrightness(0);
  }
}

void displayMessage(const char *message)
{
  tft.fillScreen(TFT_NAVY);
  tft.setCursor(0, 0);
  tft.println(message);
}

void drawImage()
{
  if (imageCount == 0 || millis() - lastImageTime < imageRefresh)
  {
    return;
  }
  lastImageTime = millis();
  lastImageIndex = (lastImageIndex + 1) % imageCount;
  Serial.println("Drawing image");
  tft.setCursor(0, 0);
  int screenWidth = TFT_HEIGHT / 8;
  int screenHeight = ceil(TFT_WIDTH / 8.0);
  Serial.println("Screen width: " + String(screenWidth) + ", Screen height: " + String(screenHeight) + ", Image index: " + String(lastImageIndex));
  for (int i = 0; i < imageSize; i++)
  {
    int x = (i % screenWidth) * 8;
    int y = (i / screenWidth) * 8;

    if (imageBuffer[lastImageIndex * imageSize + i] == '1')
    {
      if (tft.readPixel(x, y) == TFT_WHITE)
      {
        continue;
      }
      tft.fillRect(x, y, 8, 8, TFT_WHITE);
    }
    else
    {
      if (tft.readPixel(x, y) == TFT_NAVY)
      {
        continue;
      }
      tft.fillRect(x, y, 8, 8, TFT_NAVY);
    }
  }
}

void toggleDisplay(bool state)
{
  displayOn = state;
  ledcWrite(0, displayOn ? tftBrightness : 0);

  if (displayOn)
  {
    lastMessage = millis();
  }
  else
  {
    Serial.println("Turning off display");
  }
}

void colorFill(CRGB c)
{
  for (int i = 0; i < NUM_LEDS; i++)
  {
    leds[i] = c;
    FastLED.show();
    delay(50);
  }
  delay(500);
}

void fillWhite()
{
  for (int i = 0; i < NUM_LEDS; i++)
  {
    leds[i] = CRGBW(0, 0, 0, 255);
    FastLED.show();
    delay(50);
  }
  delay(500);
}

void rainbow()
{
  static uint8_t hue;
  for (int i = 0; i < NUM_LEDS; i++)
  {
    leds[i] = CHSV((i * 256 / NUM_LEDS) + hue, 255, 255);
  }
  FastLED.show();
  hue++;
}

void rainbowLoop()
{
  long millisIn = millis();
  long loopTime = 5000; // 5 seconds
  while (millis() < millisIn + loopTime)
  {
    rainbow();
    delay(5);
  }
}
