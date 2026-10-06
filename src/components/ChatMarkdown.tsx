import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const sanitizeMarkdown = (text: string): string => {
  return text
    // Ensure a blank line before any heading that isn't already preceded by one
    .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
    // Ensure a blank line after a table's last row before non-table content follows
    .replace(/(\|[^\n]*\|)\n([^\|\n])/g, '$1\n\n$2')
    // Ensure a blank line before a table starts, if directly preceded by other text
    .replace(/([^\n])\n(\|)/g, '$1\n\n$2');
};

const cleanContent = (text: string) => sanitizeMarkdown(text.replace(/<think>[\s\S]*?<\/think>/g, '').trim());

interface ChatMarkdownProps {
  content: string;
}

export default function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="text-[15px] leading-[1.6] break-words max-w-full w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({children}) => <h1 className="text-base font-bold text-primary-text mt-3 mb-2 first:mt-0">{children}</h1>,
          h2: ({children}) => <h2 className="text-sm font-bold text-primary-text mt-3 mb-1.5 first:mt-0">{children}</h2>,
          h3: ({children}) => <h3 className="text-sm font-semibold text-primary-text mt-2.5 mb-1 first:mt-0">{children}</h3>,
          p: ({children}) => <p className="mb-2 last:mb-0 leading-[1.6]">{children}</p>,
          ul: ({children}) => <ul className="list-disc ml-3 mb-2 last:mb-0 space-y-1">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal ml-3 mb-2 last:mb-0 space-y-1">{children}</ol>,
          li: ({children}) => <li className="leading-[1.6]">{children}</li>,
          strong: ({children}) => <strong className="font-bold text-primary-text">{children}</strong>,
          em: ({children}) => <em className="italic">{children}</em>,
          hr: () => <hr className="border-white/10 my-3" />,
          code: ({children}) => <code className="bg-black/30 px-1.5 py-0.5 rounded text-xs font-mono break-all">{children}</code>,
          pre: ({children}) => <pre className="bg-black/30 p-3 rounded-lg overflow-x-auto max-w-full text-xs font-mono my-2">{children}</pre>,
          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-accent underline break-words">{children}</a>,
          table: ({children}) => <div className="overflow-x-auto max-w-full my-3 rounded-lg border border-white/10"><table className="w-full text-xs border-collapse">{children}</table></div>,
          thead: ({children}) => <thead className="bg-white/5">{children}</thead>,
          tbody: ({children}) => <tbody>{children}</tbody>,
          tr: ({children}) => <tr className="border-b border-white/5 last:border-0">{children}</tr>,
          th: ({children}) => <th className="text-left px-3 py-2 font-semibold text-primary-text">{children}</th>,
          td: ({children}) => <td className="px-3 py-2 text-muted-text align-top">{children}</td>,
        }}
      >
        {cleanContent(content)}
      </ReactMarkdown>
    </div>
  );
}
