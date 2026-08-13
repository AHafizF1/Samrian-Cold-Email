"use client";

import * as React from "react";
import { Upload, FileText, X, Download } from "lucide-react";
import { StepHeader, WizardFooter, WizardContainer } from "./shared";

interface CsvUploadProps {
  onNext: (file: File, rawData: string[][]) => void;
  onBack: () => void;
  onCancel: () => void;
}

export function CsvUpload({ onNext, onBack, onCancel }: CsvUploadProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [rawData, setRawData] = React.useState<string[][]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      // Simple CSV parsing (handles basic cases)
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      alert("Please upload a CSV file");
      return;
    }

    const text = await selectedFile.text();
    const parsed = parseCSV(text);

    setFile(selectedFile);
    setRawData(parsed);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setRawData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={2}
        stepLabel="Upload CSV"
        title="Upload Your CSV File"
        description="Import contacts from your spreadsheet"
      />

      {/* Upload Area */}
      {!file ? (
        <div className="mb-12">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-16 text-center transition-all ${
              isDragging
                ? "border-indigo-600 bg-indigo-50"
                : "border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50"
            }`}
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
              <Upload className="h-8 w-8 text-indigo-600" />
            </div>
            <h3 className="mb-2 font-[family-name:var(--font-plus-jakarta)] text-xl font-bold text-slate-900">
              Drag and drop your CSV file here
            </h3>
            <p className="mb-6 text-sm text-slate-600">or click to browse</p>
            <p className="text-xs text-slate-500">Supports .csv files up to 10MB</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
            <Download className="h-4 w-4" />
            <button className="font-semibold text-indigo-600 hover:underline">
              Download sample CSV template
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-12">
          {/* File Info */}
          <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
                <FileText className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-600">
                  {(file.size / 1024).toFixed(1)} KB • {rawData.length} rows
                </p>
              </div>
            </div>
            <button
              onClick={removeFile}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Preview */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-3">
              <p className="text-sm font-semibold text-slate-700">Preview (first 3 rows)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {rawData[0]?.map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.slice(1, 4).map((row, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-3 text-sm text-slate-700">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <WizardFooter
        onBack={onBack}
        onCancel={onCancel}
        onNext={() => file && onNext(file, rawData)}
        nextLabel="Next: Map Fields"
        nextDisabled={!file}
      />
    </WizardContainer>
  );
}
