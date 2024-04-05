#include <ArduinoWebsockets.h>

using namespace websockets;
extern WebsocketsClient client;
extern bool offlineMode;

void socketLog(String level, String message)
{
    if (offlineMode)
    {
        Serial.println("[" + String(level) + "] " + String(message));
        return;
    }
    client.send("{\"event\":\"log\",\"data\":{\"level\":\"" + String(level) + "\",\"message\":\"" + String(message) + "\"}}");
}

void socketLog(String message)
{
    socketLog("info", message);
}
