interface WindowChromeProps {
  label: string;
  showMinimize?: boolean;
  showZoom?: boolean;
}

export function WindowChrome({
  label,
  showMinimize = true,
  showZoom = true,
}: WindowChromeProps) {
  const handleClose = () => {
    if (window.api.closeWindow) {
      void window.api.closeWindow();
      return;
    }

    window.close();
  };

  const handleMinimize = () => {
    if (window.api.minimizeWindow) {
      void window.api.minimizeWindow();
    }
  };

  const handleZoom = () => {
    if (window.api.toggleMaximizeWindow) {
      void window.api.toggleMaximizeWindow();
    }
  };

  return (
    <div className="window-chrome">
      <div className="window-chrome__controls window-no-drag">
        <button
          type="button"
          aria-label="Close window"
          className="window-control window-control--close"
          onClick={handleClose}
        />
        {showMinimize ? (
          <button
            type="button"
            aria-label="Minimize window"
            className="window-control window-control--minimize"
            onClick={handleMinimize}
          />
        ) : null}
        {showZoom ? (
          <button
            type="button"
            aria-label="Zoom window"
            className="window-control window-control--zoom"
            onClick={handleZoom}
          />
        ) : null}
      </div>

      <p className="window-chrome__label">{label}</p>
      <div className="window-chrome__spacer" aria-hidden="true" />
    </div>
  );
}
