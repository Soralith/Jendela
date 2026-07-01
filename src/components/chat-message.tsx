'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: { label: string; url: string }[];
}

const markdownComponents: Components = {
  strong: ({ children }) => (
    <span className="font-semibold text-slate-900 dark:text-slate-100">{children}</span>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-700 dark:text-slate-300">{children}</em>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-slate-100 dark:bg-slate-800 text-merah-600 dark:text-merah-400 px-1.5 py-0.5 rounded text-xs md:text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <pre className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 md:p-4 my-3 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 my-2 text-sm md:text-[15px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 my-2 text-sm md:text-[15px]">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-700 dark:text-slate-300 leading-relaxed">{children}</li>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700 text-xs md:text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 dark:bg-slate-800">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-600 dark:text-slate-400">
      {children}
    </td>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-merah-600 dark:text-merah-400 hover:underline font-medium"
    >
      {children}
    </a>
  ),
  p: ({ children }) => (
    <p className="text-sm md:text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed mb-2 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 mt-3 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1.5">{children}</h3>
  ),
  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
};

export default function ChatMessage({ role, content, sources }: ChatMessageProps) {
  const isUser = role === 'user';
  const isStatus = !isUser && content.startsWith('⚙️');

  if (isUser) {
    return (
      <div className="flex justify-end chat-msg">
        <div className="max-w-[85%] md:max-w-[65%] bg-merah-600 dark:bg-merah-500 text-white rounded-2xl rounded-br-sm px-4 md:px-5 py-3 md:py-3.5 shadow-md">
          <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start chat-msg">
      <div className="max-w-[85%] md:max-w-[70%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-sm px-4 md:px-5 py-3.5 md:py-4 shadow-sm glow-red">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs md:text-sm font-semibold text-merah-600 dark:text-merah-400 uppercase tracking-wide">
            Jendela AI
          </span>
          <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500">•</span>
          <span className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500">
            Sumber: data.go.id
          </span>
        </div>
        {isStatus ? (
          <div className="text-sm md:text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        ) : (
          <div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {content}
            </ReactMarkdown>
          </div>
        )}
        {sources && sources.length > 0 && (
          <div className="mt-2.5 md:mt-3 pt-2.5 md:pt-3 border-t border-slate-100 dark:border-slate-800">
            {sources.map((src, i) => (
              <div key={i} className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] md:text-xs font-medium text-merah-600 dark:text-merah-400 bg-merah-50 dark:bg-merah-950 px-1.5 py-0.5 rounded">
                  {src.label}
                </span>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] md:text-xs text-merah-600 dark:text-merah-400 hover:underline font-medium"
                  >
                    Lihat sumber →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
