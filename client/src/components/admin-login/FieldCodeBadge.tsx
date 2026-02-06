// 場域編號顯示元件
interface FieldCodeBadgeProps {
  fieldCode: string;
}

export default function FieldCodeBadge({ fieldCode }: FieldCodeBadgeProps) {
  return (
    <div className="p-3 bg-muted rounded-lg text-center">
      <p className="text-sm text-muted-foreground">場域編號</p>
      <p className="font-mono font-bold text-lg">{fieldCode}</p>
    </div>
  );
}
