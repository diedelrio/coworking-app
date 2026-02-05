import React from "react";
import ReactMarkdown from "react-markdown";

export default function AuthHeader({ title, markdownText }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <img
        src="/logoCoworking.png"
        alt="Coworking Sinergia"
        className="h-16 w-auto mb-3"
      />

      {title ? (
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {title}
        </h1>
      ) : null}

      {markdownText ? (
        <div className="max-w-md text-sm text-gray-600 leading-relaxed">
          <ReactMarkdown
            components={{
              a: (props) => (
                <a
                  {...props}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
              strong: (props) => <strong {...props} className="font-semibold text-gray-800" />,
              ul: (props) => <ul {...props} className="list-disc pl-5 text-left" />,
              ol: (props) => <ol {...props} className="list-decimal pl-5 text-left" />,
            }}
          >
            {markdownText}
          </ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
