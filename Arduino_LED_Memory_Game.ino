#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFiS3.h>
#include <ArduinoMqttClient.h>

const char WIFI_SSID[] = "name";
const char WIFI_PASSWORD[] = "password";

const char MQTT_BROKER[] = "broker.hivemq.com";
const int MQTT_PORT = 1883;
const char MQTT_TOPIC[] = "Project_PC/memory_game";

WiFiClient wifiClient;
MqttClient mqttClient(wifiClient);

LiquidCrystal_I2C lcd(0x27, 16, 2);
const int ledPins[4] = {8, 9, 10, 11};
const int buttonPins[4] = {2, 3, 4, 5};
const int buzzerPin = 6;

const int maxLevel = 50;
int sequence[maxLevel];
int level = 1;
int highestLevel = 0;

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("Connecting to WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startTime < 8000) {
    delay(200);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("WiFi connection failed.");
  return false;
}

bool connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (mqttClient.connected()) {
    return true;
  }

  Serial.println("Connecting to MQTT...");

  if (mqttClient.connect(MQTT_BROKER, MQTT_PORT)) {
    Serial.println("MQTT Connected!");
    return true;
  }

  Serial.print("MQTT connection failed. Error: ");
  Serial.println(mqttClient.connectError());

  return false;
}

void maintainMQTT() {
  if (WiFi.status() == WL_CONNECTED &&
      mqttClient.connected()) {
    mqttClient.poll();
  }
}

void publishScore(int score) {
  Serial.println("Game Finished!");
  Serial.print("Final Score: ");
  Serial.println(score);
  if (WiFi.status() != WL_CONNECTED) {
    if (!connectWiFi()) {
      Serial.println("Score not sent: WiFi offline.");
      return;
    }
  }
  if (!mqttClient.connected()) {
    if (!connectMQTT()) {
      Serial.println("Score not sent: MQTT offline.");
      return;
    }
  }
  if (!mqttClient.beginMessage(MQTT_TOPIC)) {
    Serial.println("MQTT beginMessage failed.");
    return;
  }

  mqttClient.print("Level: ");
  mqttClient.print(score);

  if (mqttClient.endMessage()) {
    Serial.print("MQTT Published: ");
    Serial.println(score);
    Serial.print("Topic: ");
    Serial.println(MQTT_TOPIC);
  } else {
    Serial.println("MQTT publish failed.");
  }
}


void buzzerOn() {
  digitalWrite(buzzerPin, LOW);
}

void buzzerOff() {
  digitalWrite(buzzerPin, HIGH);
}

void wrongSound() {
  for (int i = 0; i < 2; i++) {
    buzzerOn();
    delay(400);
    buzzerOff();
    delay(200);
  }
}

void scoreSound() {
  for (int i = 0; i < 3; i++) {
    buzzerOn();
    delay(100);
    buzzerOff();
    delay(120);
  }
}

void allLedsOff() {
  for (int i = 0; i < 4; i++) {
    digitalWrite(ledPins[i], LOW);
  }
}

void showStartScreen() {
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Wanna Try");

  lcd.setCursor(0, 1);
  lcd.print("Press Button");
}

void waitForStart() {
  while (true) {
    maintainMQTT();

    for (int i = 0; i < 4; i++) {
      if (digitalRead(buttonPins[i]) == LOW) {
        delay(30);

        if (digitalRead(buttonPins[i]) != LOW) {
          continue;
        }

        while (digitalRead(buttonPins[i]) == LOW) {
          maintainMQTT();
          delay(10);
        }

        delay(30);
        return;
      }
    }
  }
}

void showColor(int color) {
  digitalWrite(ledPins[color], HIGH);
  delay(500);
  digitalWrite(ledPins[color], LOW);
}

void showSequence() {
  lcd.clear();

  lcd.setCursor(0, 0);
  lcd.print("Level ");
  lcd.print(level);

  lcd.setCursor(0, 1);
  lcd.print("Loading...");

  delay(700);

  for (int i = 0; i < level; i++) {
    showColor(sequence[i]);
    delay(250);

    maintainMQTT();
  }
}

void showProgress(int correctCount) {
  lcd.setCursor(0, 0);
  lcd.print("Level ");
  lcd.print(level);
  lcd.print("          ");
  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);
  lcd.print(correctCount);
  lcd.print("/");
  lcd.print(level);
}

int waitForButton() {
  while (true) {
    maintainMQTT();
    for (int i = 0; i < 4; i++) {
      if (digitalRead(buttonPins[i]) == LOW) {
        delay(30);
        if (digitalRead(buttonPins[i]) != LOW) {
          continue;
        }
        
        while (digitalRead(buttonPins[i]) == LOW) {
          maintainMQTT();
          delay(10);
        }
        delay(30);
        return i;
      }
    }
  }
}

void correctPress(int color) {
  digitalWrite(ledPins[color], HIGH);
  buzzerOn();
  delay(180);
  buzzerOff();
  digitalWrite(ledPins[color], LOW);
  delay(150);
}

void wrongAnswer() {
  buzzerOff();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("That Wrong");
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 4; i++) {
      digitalWrite(ledPins[i], HIGH);
    }
    if (j < 3) {
      buzzerOn();
    }
    delay(250);
    allLedsOff();
    buzzerOff();
    delay(250);
  }

  if (level > highestLevel) {
    highestLevel = level;
  }
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Highest: ");
  lcd.print(highestLevel);

  lcd.setCursor(0, 1);
  lcd.print("Your Level: ");
  lcd.print(level - 1);

  scoreSound();
  publishScore(level - 1);
  delay(3000);
}

void resetGame() {
  level = 1;
  sequence[0] = random(0, 4);
}

void setup() {
  Serial.begin(115200);
  digitalWrite(buzzerPin, HIGH);
  pinMode(buzzerPin, OUTPUT);
  buzzerOff();
  for (int i = 0; i < 4; i++) {
    pinMode(ledPins[i], OUTPUT);
    pinMode(buttonPins[i], INPUT_PULLUP);
  }
  allLedsOff();
  randomSeed(analogRead(A0));

  lcd.init();
  lcd.backlight();

  if (connectWiFi()) {
    connectMQTT();
  }
}

void loop() {
  showStartScreen();
  waitForStart();

  resetGame();

  bool gameOver = false;

  while (!gameOver) {
    maintainMQTT();

    showSequence();
    showProgress(0);

    bool correct = true;

    for (int i = 0; i < level; i++) {
      int answer = waitForButton();

      if (answer == sequence[i]) {
        correctPress(answer);
        showProgress(i + 1);
      } else {
        correct = false;
        break;
      }
    }

    if (correct) {
      if (level > highestLevel) {
        highestLevel = level;
      }

      if (level < maxLevel) {
        sequence[level] = random(0, 4);
        level++;
      } else {
        publishScore(maxLevel);
        gameOver = true;
      }

      delay(800);
    } else {
      wrongAnswer();
      gameOver = true;
    }
  }
}
