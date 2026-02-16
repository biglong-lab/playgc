// 遊戲管理 - 表格元件
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Trash2, QrCode, Check, X, Workflow,
  Settings, Image as ImageIcon,
} from "lucide-react";
import type { Game } from "@shared/schema";
import {
  STATUS_LABELS, STATUS_COLORS,
  DIFFICULTY_LABELS, normalizeStatus,
} from "@/components/admin-games";

// 共用操作 props（表格和行共用）
interface GameActionProps {
  onNavigate: (path: string) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
  onPublish: (id: string, status: string) => void;
  onGenerateQR: (id: string) => void;
  onViewQR: (game: Game) => void;
  onCoverUpload: (game: Game) => void;
  publishPending: boolean;
  generateQRPending: boolean;
}

interface GamesTableProps extends GameActionProps {
  games: Game[];
}

export function GamesTable({
  games, onNavigate, onEdit, onDelete,
  onPublish, onGenerateQR, onViewQR, onCoverUpload,
  publishPending, generateQRPending,
}: GamesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>遊戲名稱</TableHead>
          <TableHead>難度</TableHead>
          <TableHead>時長</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>QR Code</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {games.map((game) => (
          <GameRow
            key={game.id}
            game={game}
            onNavigate={onNavigate}
            onEdit={onEdit}
            onDelete={onDelete}
            onPublish={onPublish}
            onGenerateQR={onGenerateQR}
            onViewQR={onViewQR}
            onCoverUpload={onCoverUpload}
            publishPending={publishPending}
            generateQRPending={generateQRPending}
          />
        ))}
      </TableBody>
    </Table>
  );
}

// 單一遊戲行
function GameRow({
  game, onNavigate, onEdit, onDelete,
  onPublish, onGenerateQR, onViewQR, onCoverUpload,
  publishPending, generateQRPending,
}: GameActionProps & { game: Game }) {
  const status = normalizeStatus(game.status);

  return (
    <TableRow data-testid={`row-game-${game.id}`}>
      <TableCell>
        <div>
          <div className="font-medium">{game.title}</div>
          {game.description && (
            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
              {game.description}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {game.difficulty && DIFFICULTY_LABELS[game.difficulty]}
      </TableCell>
      <TableCell>
        {game.estimatedTime ? `${game.estimatedTime} 分鐘` : "-"}
      </TableCell>
      <TableCell>
        <Badge className={STATUS_COLORS[status]} variant="secondary">
          {STATUS_LABELS[status]}
        </Badge>
      </TableCell>
      <TableCell>
        <QRCodeCell
          game={game}
          onViewQR={onViewQR}
          onGenerateQR={onGenerateQR}
          generateQRPending={generateQRPending}
        />
      </TableCell>
      <TableCell className="text-right">
        <ActionButtons
          game={game}
          status={status}
          onNavigate={onNavigate}
          onEdit={onEdit}
          onDelete={onDelete}
          onPublish={onPublish}
          onCoverUpload={onCoverUpload}
          publishPending={publishPending}
        />
      </TableCell>
    </TableRow>
  );
}

// QR Code 欄位
function QRCodeCell({
  game, onViewQR, onGenerateQR, generateQRPending,
}: {
  game: Game;
  onViewQR: (game: Game) => void;
  onGenerateQR: (id: string) => void;
  generateQRPending: boolean;
}) {
  if (game.publicSlug) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onViewQR(game)}
        data-testid={`button-view-qr-${game.id}`}
      >
        <QrCode className="h-4 w-4 mr-1" />
        檢視
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onGenerateQR(game.id)}
      disabled={generateQRPending}
      data-testid={`button-generate-qr-${game.id}`}
    >
      <QrCode className="h-4 w-4 mr-1" />
      產生
    </Button>
  );
}

// 操作按鈕群組
function ActionButtons({
  game, status, onNavigate, onEdit, onDelete,
  onPublish, onCoverUpload, publishPending,
}: {
  game: Game;
  status: string;
  onNavigate: (path: string) => void;
  onEdit: (game: Game) => void;
  onDelete: (game: Game) => void;
  onPublish: (id: string, status: string) => void;
  onCoverUpload: (game: Game) => void;
  publishPending: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onNavigate(`/admin/games/${game.id}`)}
        data-testid={`button-edit-flow-${game.id}`}
      >
        <Workflow className="h-4 w-4 mr-1" />
        編輯流程
      </Button>
      <PublishButton
        gameId={game.id}
        status={status}
        onPublish={onPublish}
        publishPending={publishPending}
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onCoverUpload(game)}
        title="上傳封面圖片"
        data-testid={`button-cover-${game.id}`}
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onEdit(game)}
        title="編輯基本設定"
        data-testid={`button-edit-${game.id}`}
      >
        <Settings className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(game)}
        data-testid={`button-delete-${game.id}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

// 發布/取消發布按鈕
function PublishButton({
  gameId, status, onPublish, publishPending,
}: {
  gameId: string;
  status: string;
  onPublish: (id: string, status: string) => void;
  publishPending: boolean;
}) {
  if (status === "draft") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPublish(gameId, "published")}
        disabled={publishPending}
        data-testid={`button-publish-${gameId}`}
      >
        <Check className="h-4 w-4 mr-1" />
        發布
      </Button>
    );
  }

  if (status === "published") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPublish(gameId, "draft")}
        disabled={publishPending}
        data-testid={`button-unpublish-${gameId}`}
      >
        <X className="h-4 w-4 mr-1" />
        取消發布
      </Button>
    );
  }

  return null;
}
