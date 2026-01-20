import React, { useState, useMemo } from 'react';

interface JsonViewerProps {
  data: unknown;
  searchTerm?: string;
  defaultExpanded?: boolean;
  level?: number;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  searchTerm = '',
  defaultExpanded = true,
  level = 0
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded && level < 2);
  const isArray = Array.isArray(data);
  const isObject = data !== null && typeof data === 'object';
  const isEmpty = isObject && (isArray ? (data as any[]).length === 0 : Object.keys(data).length === 0);

  const renderValue = (value: any): string => {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  const renderPrimitive = (value: any): React.ReactNode => {
    const type = typeof value;
    let className = 'json-value';

    if (type === 'string') className += ' json-string';
    else if (type === 'number') className += ' json-number';
    else if (type === 'boolean') className += ' json-boolean';
    else if (value === null) className += ' json-null';

    const highlighted = searchTerm && String(value).toLowerCase().includes(searchTerm.toLowerCase());

    return (
      <span className={`${className} ${highlighted ? 'json-highlight' : ''}`}>
        {renderValue(value)}
      </span>
    );
  };

  if (!isObject) {
    return renderPrimitive(data);
  }

  const entries = Object.entries(data as Record<string, unknown>);

  const matchesSearch = useMemo(() => {
    if (!searchTerm) return true;
    const jsonStr = JSON.stringify(data).toLowerCase();
    return jsonStr.includes(searchTerm.toLowerCase());
  }, [data, searchTerm]);

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;

    return entries.filter(([key, value]) => {
      const keyMatch = key.toLowerCase().includes(searchTerm.toLowerCase());
      const valueMatch = JSON.stringify(value).toLowerCase().includes(searchTerm.toLowerCase());
      return keyMatch || valueMatch;
    });
  }, [entries, searchTerm]);

  if (isEmpty) {
    return (
      <span className="json-bracket">
        {isArray ? '[]' : '{}'}
      </span>
    );
  }

  return (
    <div className="json-node" style={{ marginLeft: level * 20 }}>
      <span
        className="json-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? '▼' : '▶'}
      </span>

      <span className="json-bracket">
        {isArray ? '[' : '{'}
      </span>

      {expanded && (
        <div className="json-children">
          {filteredEntries.map(([key, value]) => (
            <div key={key} className="json-item">
              {!isArray && (
                <>
                  <span className={`json-key ${searchTerm && key.toLowerCase().includes(searchTerm.toLowerCase()) ? 'json-highlight' : ''}`}>
                    {key}
                  </span>
                  <span className="json-colon">:</span>
                </>
              )}

              {typeof value === 'object' && value !== null ? (
                <JsonViewer
                  data={value}
                  searchTerm={searchTerm}
                  defaultExpanded={defaultExpanded}
                  level={level + 1}
                />
              ) : (
                renderPrimitive(value)
              )}
            </div>
          ))}
        </div>
      )}

      <span className="json-bracket">
        {isArray ? ']' : '}'}
      </span>
    </div>
  );
};
