import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { cn } from '@tabliodb/ui';
import type { ProjectMemberDto } from '@tabliodb/sdk';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
} from 'lexical';
import { useEffect, useMemo, useState } from 'react';

export type CommentMentionUser = Pick<ProjectMemberDto, 'avatarUrl' | 'cursorColor' | 'email' | 'name' | 'userId'>;

export type CommentComposerProps = {
  'aria-invalid'?: boolean;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  mentionUsers?: CommentMentionUser[];
  menuPlacement?: 'bottom' | 'top';
  onBlur?: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function CommentComposer({
  'aria-invalid': ariaInvalid,
  autoFocus = false,
  className,
  disabled = false,
  mentionUsers = [],
  menuPlacement = 'bottom',
  onBlur,
  onChange,
  placeholder = 'Write a comment',
  value,
}: CommentComposerProps) {
  const initialConfig = useMemo(
    () => ({
      editable: !disabled,
      editorState: () => {
        setRootText(value);
      },
      namespace: 'TabliodbCommentComposer',
      onError(error: Error) {
        throw error;
      },
      theme: {
        paragraph: 'm-0',
      },
    }),
    [],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={cn(
          'relative rounded-[var(--tabliodb-radius-md)] border bg-white transition focus-within:border-[rgb(var(--tabliodb-primary))] focus-within:ring-4 focus-within:ring-[rgb(var(--tabliodb-focus-ring))]',
          ariaInvalid ? 'border-[rgb(var(--tabliodb-danger-border))]' : 'border-[rgb(var(--tabliodb-border-strong))]',
          disabled && 'bg-[rgb(var(--tabliodb-surface))] opacity-70',
          className,
        )}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-invalid={ariaInvalid}
              className="tabliodb-scrollbar max-h-40 min-h-20 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2 text-[13px] font-semibold leading-6 text-[rgb(var(--tabliodb-ink))] outline-none"
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={
            <div className="pointer-events-none absolute left-3 top-2 text-[13px] font-semibold leading-6 text-[rgb(var(--tabliodb-ink-subtle))]">
              {placeholder}
            </div>
          }
        />
        <HistoryPlugin />
        {autoFocus ? <AutoFocusPlugin /> : null}
        <CommentComposerChangePlugin onChange={onChange} />
        <CommentComposerBlurPlugin onBlur={onBlur} />
        <CommentComposerEditablePlugin disabled={disabled} />
        <CommentComposerSyncPlugin value={value} />
        <CommentMentionPlugin disabled={disabled} menuPlacement={menuPlacement} mentionUsers={mentionUsers} />
      </div>
    </LexicalComposer>
  );
}

export default CommentComposer;

function CommentComposerChangePlugin({ onChange }: { onChange: (value: string) => void }) {
  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState) => {
        editorState.read(() => {
          onChange($getRoot().getTextContent());
        });
      }}
    />
  );
}

function CommentComposerBlurPlugin({ onBlur }: { onBlur?: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onBlur) {
      return;
    }

    return editor.registerCommand(
      BLUR_COMMAND,
      () => {
        onBlur();

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onBlur]);

  return null;
}

function CommentComposerEditablePlugin({ disabled }: { disabled: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Lexical owns its contenteditable state internally, so disabled must be mirrored into the editor instance.
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  return null;
}

function CommentComposerSyncPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.getEditorState().read(() => {
      const currentText = $getRoot().getTextContent();

      if (currentText === value) {
        return;
      }

      editor.update(() => {
        setRootText(value);
      });
    });
  }, [editor, value]);

  return null;
}

function CommentMentionPlugin({
  disabled,
  mentionUsers,
  menuPlacement,
}: {
  disabled: boolean;
  mentionUsers: CommentMentionUser[];
  menuPlacement: 'bottom' | 'top';
}) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestions = useMemo(() => filterMentionUsers(mentionUsers, query), [mentionUsers, query]);
  const isOpen = !disabled && query !== null && suggestions.length > 0;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          setQuery(readMentionQuery());
        });
      }),
    [editor],
  );

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!isOpen) {
          return false;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((index) => (index + 1) % suggestions.length);

          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((index) => (index - 1 + suggestions.length) % suggestions.length);

          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          insertMention(editor, suggestions[selectedIndex]);
          setQuery(null);

          return true;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setQuery(null);

          return true;
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, isOpen, selectedIndex, suggestions]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute left-2 right-2 z-[70] overflow-hidden rounded-[var(--tabliodb-radius-md)] border border-[rgb(var(--tabliodb-border-strong))] bg-white shadow-[0_3px_0_rgb(var(--tabliodb-border-strong)),0_14px_32px_rgb(15_23_42/0.14)]',
        menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
      )}
    >
      {suggestions.map((user, index) => (
        <button
          className={cn(
            'flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition',
            index === selectedIndex
              ? 'bg-[rgb(var(--tabliodb-selected-surface))]'
              : 'hover:bg-[rgb(var(--tabliodb-surface))]',
          )}
          key={user.userId}
          onMouseDown={(event) => {
            event.preventDefault();
            insertMention(editor, user);
            setQuery(null);
          }}
          type="button"
        >
          <span
            className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[12px] border-2 border-[rgb(var(--tabliodb-border))] bg-[rgb(var(--tabliodb-primary-soft))] text-[11px] font-extrabold text-[rgb(var(--tabliodb-primary-text))]"
            style={user.cursorColor ? { backgroundColor: user.cursorColor } : undefined}
          >
            {user.avatarUrl ? (
              <img alt="" className="size-full object-cover" src={user.avatarUrl} />
            ) : (
              getMentionInitials(user)
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-extrabold text-[rgb(var(--tabliodb-ink))]">
              {user.name}
            </span>
            <span className="block truncate text-xs font-bold text-[rgb(var(--tabliodb-ink-muted))]">{user.email}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function setRootText(value: string) {
  const root = $getRoot();
  root.clear();

  const paragraph = $createParagraphNode();
  paragraph.append($createTextNode(value));
  root.append(paragraph);
}

function readMentionQuery(): string | null {
  const selection = $getSelection();

  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchor = selection.anchor;
  const node = anchor.getNode();

  if (!$isTextNode(node)) {
    return null;
  }

  const textBeforeCursor = node.getTextContent().slice(0, anchor.offset);
  const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([\p{L}\p{N}._-]{0,32})$/u);

  return mentionMatch?.[1] ?? null;
}

function insertMention(editor: LexicalEditor, user: CommentMentionUser | undefined) {
  if (!user) {
    return;
  }

  editor.update(() => {
    const selection = $getSelection();

    if (!$isRangeSelection(selection)) {
      return;
    }

    const mentionText = `@${user.name} `;
    const anchor = selection.anchor;
    const node = anchor.getNode();

    if (!$isTextNode(node) || !selection.isCollapsed()) {
      selection.insertText(mentionText);
      return;
    }

    const textBeforeCursor = node.getTextContent().slice(0, anchor.offset);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([\p{L}\p{N}._-]{0,32})$/u);

    if (!mentionMatch) {
      selection.insertText(mentionText);
      return;
    }

    const leadingSpaceOffset = mentionMatch[0].startsWith(' ') ? 1 : 0;
    const mentionStart = anchor.offset - mentionMatch[0].length + leadingSpaceOffset;

    // Mention saat ini disimpan sebagai plain text agar backend existing tetap kompatibel; node khusus bisa ditambahkan saat notification dibuat.
    node.spliceText(mentionStart, anchor.offset - mentionStart, mentionText, true);
  });

  window.setTimeout(() => editor.focus(), 0);
}

function filterMentionUsers(users: CommentMentionUser[], query: string | null): CommentMentionUser[] {
  if (query === null) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();

  return users
    .filter((user) =>
      normalizedQuery ? [user.name, user.email].some((value) => value.toLowerCase().includes(normalizedQuery)) : true,
    )
    .slice(0, 6);
}

function getMentionInitials(user: Pick<CommentMentionUser, 'email' | 'name'>): string {
  const source = user.name.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
