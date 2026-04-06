import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { FileText, Code, Layout, Wand2, Loader2, Maximize2, Minimize2, Download, Undo, Redo, Sun, Moon, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { toJpeg, toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const DEFAULT_MARKDOWN = ``;

export default function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [copied, setCopied] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [editorWidth, setEditorWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([DEFAULT_MARKDOWN]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !editorRef.current) return;
      e.preventDefault(); // Prevent text selection glitching
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 10 && newWidth < 90) {
        // Direct DOM manipulation for buttery smooth 60fps dragging (bypasses React render)
        editorRef.current.style.width = `${newWidth}%`;
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        // Sync final width back to React state
        if (editorRef.current) {
          setEditorWidth(parseFloat(editorRef.current.style.width));
        }
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent highlighting text while dragging
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMarkdown(newValue);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newValue);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setMarkdown(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setMarkdown(history[newIndex]);
    }
  };

  const handleFixMarkdown = async () => {
    if (!markdown.trim() || isFixing) return;
    setIsFixing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Bạn là một chuyên gia về Markdown và LaTeX (đặc biệt là phương trình hóa học và toán học). 
Hãy phân tích và sửa các lỗi cú pháp, định dạng trong đoạn văn bản sau để nó hiển thị chính xác nhất.
- Sửa lỗi cú pháp LaTeX (ví dụ: thiếu $$, sai lệnh mũi tên phản ứng, thiếu ngoặc).
- Đảm bảo các phương trình hóa học dùng đúng lệnh mũi tên (như \\xrightarrow, \\xrightleftharpoons).
- Giữ nguyên nội dung tiếng Việt và ý nghĩa gốc.
- CHỈ trả về văn bản đã sửa, không giải thích gì thêm.

Văn bản gốc:
${markdown}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      if (response.text) {
        const newValue = response.text.trim();
        setMarkdown(newValue);
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newValue);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    } catch (error) {
      console.error("Lỗi khi sửa văn bản:", error);
      alert("Có lỗi xảy ra khi phân tích văn bản. Vui lòng thử lại.");
    } finally {
      setIsFixing(false);
    }
  };

  const handleExportPDF = async () => {
    if (!previewRef.current) return;
    setIsExportMenuOpen(false);
    
    try {
      const element = previewRef.current;
      
      // Get the actual full dimensions of the content
      const width = element.scrollWidth;
      const height = element.scrollHeight;
      
      // html-to-image supports modern CSS like oklch by using SVG foreignObject
      const dataUrl = await toJpeg(element, {
        quality: 0.85, // Lower quality for smaller file size
        backgroundColor: isDarkMode ? '#171717' : '#ffffff',
        pixelRatio: 2, // Reduced from 3 to 2 for smaller file size while keeping text readable
        width: width,
        height: height,
        style: {
          margin: '0',
          padding: '0',
        }
      });
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => img.onload = resolve);

      // Create PDF with exact dimensions of the image + padding
      const padding = 30;
      const pdfWidth = width + (padding * 2);
      const pdfHeight = height + (padding * 2);

      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pdfWidth, pdfHeight],
        compress: true // Enable PDF compression
      });
      
      // Add background
      pdf.setFillColor(isDarkMode ? 23 : 255, isDarkMode ? 23 : 255, isDarkMode ? 23 : 255);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      
      // Draw image with padding offset
      pdf.addImage(dataUrl, 'JPEG', padding, padding, width, height, undefined, 'FAST');
      pdf.save('document.pdf');
    } catch (error) {
      console.error('Lỗi khi xuất PDF:', error);
      alert('Không thể xuất PDF. Vui lòng thử lại.');
    }
  };

  const handleExportImage = async (format: 'png' | 'jpeg') => {
    if (!previewRef.current) return;
    setIsExportMenuOpen(false);
    
    try {
      const element = previewRef.current;
      const width = element.scrollWidth;
      const height = element.scrollHeight;
      
      const options = {
        quality: 1.0,
        backgroundColor: isDarkMode ? '#171717' : '#ffffff',
        pixelRatio: 2,
        width: width,
        height: height,
        style: {
          margin: '0',
          padding: '20px',
        }
      };
      
      const dataUrl = format === 'png' 
        ? await toPng(element, options)
        : await toJpeg(element, options);
      
      const link = document.createElement('a');
      link.download = `document.${format}`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error(`Lỗi khi xuất ${format.toUpperCase()}:`, error);
      alert(`Không thể xuất ${format.toUpperCase()}. Vui lòng thử lại.`);
    }
  };

  return (
    <div className={`h-screen flex flex-col font-sans print:bg-white transition-colors duration-200 ${isDarkMode ? 'dark bg-neutral-900' : 'bg-neutral-50'}`}>
      {/* Header */}
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4 flex items-center justify-between shadow-sm z-20 shrink-0 print:hidden transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 leading-tight">Markdown to Rich Text</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Chuyển đổi & tải file pdf giữ nguyên định dạng.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2.5 text-neutral-500 hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            title={isDarkMode ? "Chế độ sáng" : "Chế độ tối"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm active:scale-95 cursor-pointer"
              title="Tùy chọn lưu"
            >
              <Download className="w-4.5 h-4.5" />
              Lưu
              <ChevronDown className="w-4 h-4 ml-1" />
            </button>
            
            {isExportMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10"
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 py-1 z-20">
                  <button
                    onClick={handleExportPDF}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Lưu dưới dạng PDF
                  </button>
                  <button
                    onClick={() => handleExportImage('png')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Lưu dưới dạng PNG
                  </button>
                  <button
                    onClick={() => handleExportImage('jpeg')}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Lưu dưới dạng JPEG
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative print:overflow-visible">
        {/* Editor Pane */}
        {!isMaximized && (
          <div 
            ref={editorRef}
            style={{ width: `${editorWidth}%` }}
            className="flex flex-col border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shrink-0 print:hidden transition-colors duration-200"
          >
            <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-neutral-600 dark:text-neutral-300 flex items-center justify-between shrink-0 transition-colors duration-200">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Văn bản Markdown
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-md overflow-hidden mr-2">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex === 0}
                    className="p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Hoàn tác (Undo)"
                  >
                    <Undo className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-600" />
                  <button
                    onClick={handleRedo}
                    disabled={historyIndex === history.length - 1}
                    className="p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Làm lại (Redo)"
                  >
                    <Redo className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={handleFixMarkdown}
                  disabled={isFixing || !markdown.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Tự động phân tích và sửa lỗi cú pháp Markdown/LaTeX"
                >
                  {isFixing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {isFixing ? 'Đang sửa...' : 'Sửa lỗi'}
                </button>
              </div>
            </div>
            <textarea
              value={markdown}
              onChange={handleMarkdownChange}
              className="flex-1 w-full p-6 resize-none outline-none font-mono text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-100 bg-transparent overflow-auto"
              placeholder="Nhập nội dung markdown của bạn vào đây..."
              spellCheck={false}
            />
          </div>
        )}

        {/* Drag Handle */}
        {!isMaximized && (
          <div
            className={`w-1.5 hover:bg-indigo-400 dark:hover:bg-indigo-500 cursor-col-resize shrink-0 z-10 transition-colors print:hidden ${isDragging ? 'bg-indigo-400 dark:bg-indigo-500' : 'bg-neutral-200 dark:bg-neutral-700'}`}
            onMouseDown={() => setIsDragging(true)}
          />
        )}

        {/* Preview Pane */}
        <div className="flex flex-col bg-white dark:bg-neutral-900 overflow-hidden flex-1 print:overflow-visible print:w-full transition-colors duration-200">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 text-sm font-semibold text-neutral-600 dark:text-neutral-300 flex items-center justify-between shrink-0 print:hidden transition-colors duration-200">
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4" />
              Hiển thị thực tế
            </div>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
              title={isMaximized ? "Thu nhỏ" : "Phóng to"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-white dark:bg-neutral-900 transition-colors duration-200">
            <div 
              ref={previewRef}
              className="prose prose-indigo dark:prose-invert max-w-none"
            >
              <Markdown 
                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                rehypePlugins={[rehypeKatex]}
              >
                {markdown}
              </Markdown>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
