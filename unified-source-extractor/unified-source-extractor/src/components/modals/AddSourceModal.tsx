"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Youtube, 
  Globe, 
  FileText, 
  Upload,
  Link as LinkIcon,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddSourceData) => void;
}

interface AddSourceData {
  type: 'youtube' | 'web' | 'document';
  url?: string;
  file?: File;
}

type SourceType = 'youtube' | 'web' | 'document';

const sourceTypes = [
  {
    type: 'youtube' as SourceType,
    icon: Youtube,
    title: 'YouTube Video',
    description: 'Extract quotes from YouTube videos',
    color: 'text-red-500',
    bgColor: 'bg-red-50 border-red-200',
    placeholder: 'https://youtube.com/watch?v=...'
  },
  {
    type: 'web' as SourceType,
    icon: Globe,
    title: 'Web Article',
    description: 'Extract quotes from web articles and blogs',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 border-blue-200',
    placeholder: 'https://example.com/article'
  },
  {
    type: 'document' as SourceType,
    icon: FileText,
    title: 'Document',
    description: 'Upload PDF, Word, or text documents',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
    placeholder: 'Select a file to upload'
  }
];

export function AddSourceModal({ isOpen, onClose, onSubmit }: AddSourceModalProps) {
  const [selectedType, setSelectedType] = useState<SourceType | null>(null);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType) return;
    
    const data: AddSourceData = { type: selectedType };
    
    if (selectedType === 'document') {
      if (!file) return;
      data.file = file;
    } else {
      if (!url) return;
      data.url = url;
    }
    
    onSubmit(data);
    handleClose();
  };

  const handleClose = () => {
    setSelectedType(null);
    setUrl('');
    setFile(null);
    setDragActive(false);
    onClose();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const selectedTypeConfig = sourceTypes.find(t => t.type === selectedType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Add New Source</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!selectedType ? (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground mb-4">
                Choose the type of source you'd like to add:
              </p>
              
              {sourceTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <Card
                    key={type.type}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md border-2",
                      type.bgColor
                    )}
                    onClick={() => setSelectedType(type.type)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Icon className={cn("h-6 w-6 mt-0.5", type.color)} />
                        <div>
                          <h3 className="font-medium mb-1">{type.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected type header */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                {selectedTypeConfig && (
                  <>
                    <selectedTypeConfig.icon className={cn("h-5 w-5", selectedTypeConfig.color)} />
                    <div>
                      <h3 className="font-medium">{selectedTypeConfig.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedTypeConfig.description}
                      </p>
                    </div>
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedType(null)}
                  className="ml-auto"
                >
                  Change
                </Button>
              </div>

              {/* Input based on type */}
              {selectedType === 'document' ? (
                <div className="space-y-4">
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                      dragActive 
                        ? "border-primary bg-primary/5" 
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    )}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    {file ? (
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFile(null)}
                          className="mt-2"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-2">Drop your file here, or click to browse</p>
                        <p className="text-sm text-muted-foreground">
                          Supports PDF, Word documents, and text files
                        </p>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="file-upload"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-4"
                          onClick={() => document.getElementById('file-upload')?.click()}
                        >
                          Browse Files
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={selectedTypeConfig?.placeholder}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={selectedType === 'document' ? !file : !url}
                  className="flex-1"
                >
                  Add Source
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}