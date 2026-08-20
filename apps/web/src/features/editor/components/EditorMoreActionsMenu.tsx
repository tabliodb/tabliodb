import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparatorItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tabliodb/ui';
import {
  Code2,
  Copy,
  Download,
  FileImage,
  FileJson,
  FileText,
  FileUp,
  GitBranch,
  ImageDown,
  Keyboard,
  MoreHorizontal,
  Redo2,
  Share2,
  Undo2,
} from 'lucide-react';

type MenuAction = () => Promise<void> | void;

export function EditorMoreActionsMenu({
  canEdit,
  canRedo,
  canUndo,
  isExporting,
  isImporting,
  onCopySql,
  onDownloadSql,
  onExportJson,
  onExportMarkdown,
  onExportMermaid,
  onExportPng,
  onExportSvg,
  onImportJson,
  onImportSql,
  onOpenKeyboardShortcuts,
  onRedo,
  onShareReadOnlyLink,
  onUndo,
}: {
  canEdit: boolean;
  canRedo: boolean;
  canUndo: boolean;
  isExporting: boolean;
  isImporting: boolean;
  onCopySql: MenuAction;
  onDownloadSql: MenuAction;
  onExportJson: MenuAction;
  onExportMarkdown: MenuAction;
  onExportMermaid: MenuAction;
  onExportPng: MenuAction;
  onExportSvg: MenuAction;
  onImportJson: MenuAction;
  onImportSql: MenuAction;
  onOpenKeyboardShortcuts: MenuAction;
  onRedo: MenuAction;
  onShareReadOnlyLink: MenuAction;
  onUndo: MenuAction;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More actions" size="icon" type="button" variant="secondary">
              {/* Trigger menu sekunder dibuat button langsung supaya Radix tidak kehilangan focus target. */}
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>More actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        {canEdit ? (
          <>
            <DropdownMenuItem disabled={!canUndo} onSelect={() => void onUndo()}>
              <Undo2 className="size-4" />
              Undo last edit
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canRedo} onSelect={() => void onRedo()}>
              <Redo2 className="size-4" />
              Redo last edit
            </DropdownMenuItem>
            <DropdownMenuSeparatorItem />
          </>
        ) : null}

        <DropdownMenuItem onSelect={() => void onOpenKeyboardShortcuts()}>
          <Keyboard className="size-4" />
          Keyboard shortcuts
        </DropdownMenuItem>
        {canEdit ? (
          <>
            <DropdownMenuItem onSelect={() => void onShareReadOnlyLink()}>
              <Share2 className="size-4" />
              Share read-only link
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isImporting} onSelect={() => void onImportJson()}>
              <FileUp className="size-4" />
              Import Tabliodb JSON
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isImporting} onSelect={() => void onImportSql()}>
              <Code2 className="size-4" />
              Import SQL DDL
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparatorItem />
        <DropdownMenuItem disabled={isExporting} onSelect={() => void onCopySql()}>
          <Copy className="size-4" />
          Copy SQL
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isExporting} onSelect={() => void onDownloadSql()}>
          <Download className="size-4" />
          Download SQL
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isExporting} onSelect={() => void onExportJson()}>
          <FileJson className="size-4" />
          Export Tabliodb JSON
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isExporting} onSelect={() => void onExportMarkdown()}>
          <FileText className="size-4" />
          Export Markdown docs
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isExporting} onSelect={() => void onExportMermaid()}>
          <GitBranch className="size-4" />
          Export Mermaid ERD
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isExporting} onSelect={() => void onExportSvg()}>
          <FileImage className="size-4" />
          Export SVG diagram
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onExportPng()}>
          <ImageDown className="size-4" />
          Export PNG diagram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
