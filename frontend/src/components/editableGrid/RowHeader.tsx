/** Width of the row header column (drag handle, row number, error icon). */
export const ROW_HEADER_WIDTH = 64;

// Paths of MUI's DragIndicator and ErrorOutline icons. Inline SVG instead of
// MUI icon components keeps a row cheap to mount.
const DRAG_PATH = 'M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z';
const ERROR_PATH = 'M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z';

interface RowHeaderProps {
  rowIndex: number;
  hasError: boolean;
  errorMessage?: string | null;
  isSelected?: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  dragHandleProps?: Record<string, unknown>;
  /** False in read-only grids (rows can't be moved). */
  showDragHandle?: boolean;
}

export const RowHeader = ({
  rowIndex,
  hasError,
  errorMessage,
  isSelected,
  onContextMenu,
  onMouseDown,
  dragHandleProps,
  showDragHandle = true,
}: RowHeaderProps) => {
  return (
    <div
      className={`eg-row-header${isSelected ? ' eg-row-header--selected' : ''}`}
      style={{ width: ROW_HEADER_WIDTH }}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
    >
      {/* Left accent bar for active/selected row */}
      {isSelected && <span className="eg-row-header__accent" />}
      <span className="eg-row-header__drag" {...dragHandleProps} style={showDragHandle ? undefined : { visibility: 'hidden' }}>
        {showDragHandle && <svg className="eg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={DRAG_PATH} /></svg>}
      </span>
      {/* Read-only row number */}
      <span className="eg-row-header__number">{rowIndex + 1}</span>
      <span
        className="eg-row-header__error"
        style={{ visibility: hasError ? 'visible' : 'hidden' }}
        // Native tooltip: a MUI Tooltip per row is costly to mount
        title={hasError ? errorMessage ?? '' : undefined}
        role={hasError ? 'img' : undefined}
        aria-label={hasError ? errorMessage ?? '' : undefined}
      >
        <svg className="eg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={ERROR_PATH} /></svg>
      </span>
    </div>
  );
};
