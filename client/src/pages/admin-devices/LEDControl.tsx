// LED 控制面板
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Zap } from "lucide-react";
import type { ArduinoDevice } from "@shared/schema";
import { LED_MODES, LED_COLORS } from "./constants";

interface LEDControlProps {
  device: ArduinoDevice;
  ledMode: string;
  setLedMode: (mode: string) => void;
  ledColor: string;
  setLedColor: (color: string) => void;
  ledBrightness: number;
  setLedBrightness: (brightness: number) => void;
  ledSpeed: number;
  setLedSpeed: (speed: number) => void;
  onSendCommand: () => void;
  isPending: boolean;
}

export default function LEDControl({
  device,
  ledMode,
  setLedMode,
  ledColor,
  setLedColor,
  ledBrightness,
  setLedBrightness,
  ledSpeed,
  setLedSpeed,
  onSendCommand,
  isPending,
}: LEDControlProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          LED 控制 - {device.deviceName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">模式</Label>
          <div className="grid grid-cols-5 gap-1">
            {LED_MODES.map((mode) => (
              <Button
                key={mode.value}
                variant={ledMode === mode.value ? "default" : "outline"}
                size="sm"
                onClick={() => setLedMode(mode.value)}
                className="flex flex-col gap-1 h-auto py-2"
                data-testid={`button-led-mode-${mode.value}`}
              >
                <mode.icon className="w-3 h-3" />
                <span className="text-xs">{mode.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">顏色</Label>
          <div className="grid grid-cols-7 gap-1">
            {LED_COLORS.map((color) => (
              <Button
                key={color.value}
                variant={ledColor === color.value ? "default" : "outline"}
                size="sm"
                onClick={() => setLedColor(color.value)}
                className="h-8 w-8 p-0"
                style={{
                  backgroundColor: ledColor === color.value ? undefined : `rgb(${color.color.r}, ${color.color.g}, ${color.color.b})`,
                }}
                data-testid={`button-led-color-${color.value}`}
              >
                {ledColor === color.value && <span className="text-xs">&#10003;</span>}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">亮度: {ledBrightness}%</Label>
          <Slider
            value={[ledBrightness]}
            onValueChange={(v) => setLedBrightness(v[0])}
            min={0}
            max={100}
            step={10}
            data-testid="slider-led-brightness"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">速度: {ledSpeed}ms</Label>
          <Slider
            value={[ledSpeed]}
            onValueChange={(v) => setLedSpeed(v[0])}
            min={100}
            max={2000}
            step={100}
            data-testid="slider-led-speed"
          />
        </div>

        <Button
          onClick={onSendCommand}
          disabled={isPending}
          className="w-full gap-2"
          data-testid="button-send-led"
        >
          <Zap className="w-4 h-4" />
          發送 LED 指令
        </Button>
      </CardContent>
    </Card>
  );
}
