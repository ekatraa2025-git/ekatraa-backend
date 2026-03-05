'use client'

import React, { useRef, useEffect } from 'react'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'

interface RichTextEditorProps {
    value: string
    onChange: (html: string) => void
    placeholder?: string
    className?: string
    minHeight?: string
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = 'Write description...',
    className = '',
    minHeight = '120px',
}: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = editorRef.current
        if (!el) return
        if (value !== el.innerHTML) {
            el.innerHTML = value || ''
        }
    }, [value])

    const handleInput = () => {
        const html = editorRef.current?.innerHTML ?? ''
        onChange(html)
    }

    const exec = (cmd: string, value?: string) => {
        document.execCommand(cmd, false, value)
        editorRef.current?.focus()
        handleInput()
    }

    const inputClass =
        'w-full rounded-lg border border-stroke bg-white px-4 py-3 text-sm font-medium text-black shadow-sm transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-form-strokedark dark:bg-form-input dark:text-white'

    return (
        <div className={`rounded-lg border border-stroke bg-white shadow-sm dark:border-strokedark dark:bg-boxdark ${className}`}>
            <div className="flex flex-wrap items-center gap-1 border-b border-stroke px-2 py-1 dark:border-strokedark">
                <button
                    type="button"
                    onClick={() => exec('bold')}
                    className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Bold"
                >
                    <Bold className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => exec('italic')}
                    className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Italic"
                >
                    <Italic className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => exec('insertUnorderedList')}
                    className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Bullet list"
                >
                    <List className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => exec('insertOrderedList')}
                    className="rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                    title="Numbered list"
                >
                    <ListOrdered className="h-4 w-4" />
                </button>
            </div>
            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                data-placeholder={placeholder}
                className={`min-h-[${minHeight}] max-h-[320px] overflow-y-auto px-4 py-3 text-sm outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500 ${inputClass} border-0 focus:ring-0`}
                style={{ minHeight }}
            />
        </div>
    )
}
