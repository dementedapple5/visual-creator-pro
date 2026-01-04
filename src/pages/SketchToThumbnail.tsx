import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Stage, Layer, Line, Image as KonvaImage, Arrow, Text, Rect, Group, Transformer, Circle, Ellipse } from "react-konva";
import { useTranslation } from "react-i18next";
import { 
  Pencil, 
  Eraser, 
  Minus, 
  Square, 
  Circle as CircleIcon, 
  Triangle,
  Type, 
  User as UserIcon, 
  Trash2, 
  Copy,
  Download, 
  Sparkles, 
  Undo, 
  Redo,
  ChevronLeft,
  MousePointer2,
  Tags,
  Plus,
  GripVertical,
  Layers as LayersIcon,
  Eye,
  EyeOff,
  Save,
  FileText,
  Edit,
  Image as ImageIcon,
  Upload
} from "lucide-react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import useImage from "use-image";
import { Loader2 } from "lucide-react";

interface SketchLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
}

interface AvatarElement {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  rotation: number;
}

type CanvasElement = 
  | { type: "line"; id: string; tool: string; points: number[]; stroke: string; strokeWidth: number }
  | { type: "avatar"; id: string; url: string; x: number; y: number; width: number; height: number; rotation: number }
  | { type: "label"; id: string; text: string; x: number; y: number; targetX: number; targetY: number }
  | { type: "text"; id: string; text: string; x: number; y: number; fontSize: number; fill: string; rotation: number }
  | { type: "shape"; id: string; shapeType: "rectangle" | "circle" | "triangle"; x: number; y: number; width: number; height: number; stroke: string; strokeWidth: number; fill: string; rotation: number; text?: string; textColor?: string };

interface LayerData {
  id: string;
  name: string;
  elements: CanvasElement[];
  isVisible?: boolean;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

const INITIAL_LAYERS: LayerData[] = [
  { 
    id: "layer-1", 
    name: "Layer 1", 
    elements: [],
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0
  }
];

const SketchToThumbnail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sketchId = searchParams.get("id");
  
  const [tool, setTool] = useState<"pencil" | "line" | "eraser" | "label" | "text" | "select" | "rectangle" | "circle" | "triangle" | "instructions">("pencil");
  const [layers, setLayers] = useState<LayerData[]>(INITIAL_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>("layer-1");
  const [undoStack, setUndoStack] = useState<LayerData[][]>([]);
  const [redoStack, setRedoStack] = useState<LayerData[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isAssetsDialogOpen, setIsAssetsDialogOpen] = useState(false);
  const [isEditTextDialogOpen, setIsEditTextDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [sketchName, setSketchName] = useState("Untitled Sketch");
  const [isSaving, setIsSaving] = useState(false);
  const [editingElement, setEditingElement] = useState<{ id: string; text: string; title: string } | null>(null);
  const [userAvatars, setUserAvatars] = useState<any[]>([]);
  const [userElements, setUserElements] = useState<any[]>([]);
  const [userBackgrounds, setUserBackgrounds] = useState<any[]>([]);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [isPenInput, setIsPenInput] = useState(false);
  const [currentPressure, setCurrentPressure] = useState(0.5);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextPosition, setEditingTextPosition] = useState<{ x: number; y: number; fontSize: number; fill: string; rotation: number } | null>(null);
  
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false); // Ref for touch events to avoid stale closures
  const instructionsButtonRef = useRef<HTMLButtonElement>(null);
  const [instructionsInputPos, setInstructionsInputPos] = useState({ x: 0, y: 0 });
  const previousToolRef = useRef<Exclude<typeof tool, "instructions">>("select");
  const textInputRef = useRef<HTMLInputElement>(null);

  const toggleInstructionsTool = () => {
    setTool((current) => {
      if (current === "instructions") {
        return previousToolRef.current;
      }
      previousToolRef.current = current as Exclude<typeof tool, "instructions">;
      return "instructions";
    });
  };

  // Load sketch from cloud or draft
  useEffect(() => {
    const loadSketch = async () => {
      // 1. Check if we have a local cache for this specific state (new or existing ID)
      const cacheKey = sketchId ? `sketch-cache-${sketchId}` : "sketch-cache-new";
      const cached = localStorage.getItem(cacheKey);
      let cachedData = null;
      
      if (cached) {
        try {
          cachedData = JSON.parse(cached);
        } catch (e) {
          console.error("Error parsing sketch cache:", e);
        }
      }

      if (sketchId) {
        const { data, error } = await (supabase as any)
          .from("sketches")
          .select("*")
          .eq("id", sketchId)
          .single();
        
        if (data && !error) {
          const cloudData = (data as any).data;
          const cloudName = (data as any).name;
          const cloudUpdatedAt = (data as any).updated_at;

          // If we have a cache, check if it's newer than the cloud version
          if (cachedData && cachedData.updatedAt && cloudUpdatedAt && new Date(cachedData.updatedAt) > new Date(cloudUpdatedAt)) {
            setLayers(cachedData.layers);
            setAdditionalPrompt(cachedData.additionalPrompt || "");
            setSketchName(cachedData.sketchName || cloudName);
            toast.info(t("sketches.restoredFromCache") || "Restored unsaved changes from local cache");
          } else {
            if (cloudData.layers) setLayers(cloudData.layers);
            if (cloudData.additionalPrompt) setAdditionalPrompt(cloudData.additionalPrompt);
            setSketchName(cloudName);
            toast.success(t("sketches.loadCloud"));
          }
          return;
        }
      } else {
        // If no sketchId, we are creating a new sketch
        // Check if there's a cached "new" sketch
        if (cachedData && cachedData.layers && (cachedData.layers.some((l: any) => l.elements.length > 0) || cachedData.additionalPrompt)) {
          setLayers(cachedData.layers);
          setAdditionalPrompt(cachedData.additionalPrompt || "");
          setSketchName(cachedData.sketchName || "Untitled Sketch");
          toast.info(t("sketches.restoredNew") || "Restored your unsaved sketch draft");
        } else {
          // Reset state to empty canvas
          setLayers(INITIAL_LAYERS);
          setAdditionalPrompt("");
          setSketchName("Untitled Sketch");
          setSelectedId(null);
          setActiveLayerId("layer-1");
          setUndoStack([]);
          setRedoStack([]);
        }
      }
    };

    loadSketch();
  }, [sketchId, t]);

  const handleSaveSketch = async () => {
    // Open dialog to save to cloud
    setIsSaveDialogOpen(true);
  };

  const saveToCloud = async () => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Export preview
      const previewBase64 = stageRef.current.toDataURL({ pixelRatio: 0.5 }); // Lower res for preview
      const previewBinary = Uint8Array.from(atob(previewBase64.split(",")[1]), c => c.charCodeAt(0));
      
      const previewFileName = `${user.id}/${Date.now()}-preview.png`;
      const { error: uploadError } = await supabase.storage
        .from("sketches")
        .upload(previewFileName, previewBinary, { contentType: "image/png", upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sketches")
        .getPublicUrl(previewFileName);

      const sketchData = {
        layers,
        additionalPrompt
      };

      if (sketchId) {
        // Update existing
        const { error } = await (supabase as any)
          .from("sketches")
          .update({
            name: sketchName,
            data: sketchData,
            preview_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq("id", sketchId);
        
        if (error) throw error;
        localStorage.removeItem(`sketch-cache-${sketchId}`);
        toast.success(t("sketches.updateSuccess"));
      } else {
        // Insert new
        const { data, error } = await (supabase as any)
          .from("sketches")
          .insert({
            user_id: user.id,
            name: sketchName,
            data: sketchData,
            preview_url: publicUrl
          })
          .select()
          .single();
        
        if (error) throw error;
        localStorage.removeItem("sketch-cache-new");
        toast.success(t("sketches.saveSuccess"));
        // Update URL with new ID without reloading
        navigate(`/sketch?id=${data.id}`, { replace: true });
      }
      setIsSaveDialogOpen(false);
    } catch (err: any) {
      console.error("Cloud save error:", err);
      toast.error(err.message || t("sketches.errors.failedSave") || "Failed to save to cloud");
    } finally {
      setIsSaving(false);
    }
  };

  const getCursorClass = () => {
    switch (tool) {
      case "select": return "cursor-default";
      case "pencil":
      case "line": 
      case "rectangle":
      case "circle":
      case "triangle": return "cursor-crosshair";
      case "eraser": return "cursor-cell";
      case "label": return "cursor-copy";
      case "text": return "cursor-text";
      case "instructions": return "cursor-default";
      default: return "cursor-crosshair";
    }
  };

  const updateCursor = (newTool: string) => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const container = stage.container();
    
    switch (newTool) {
      case "select": container.style.cursor = "default"; break;
      case "pencil":
      case "line": 
      case "rectangle":
      case "circle":
      case "triangle": container.style.cursor = "crosshair"; break;
      case "eraser": container.style.cursor = "cell"; break;
      case "label": container.style.cursor = "copy"; break;
      case "text": container.style.cursor = "text"; break;
      default: container.style.cursor = "default";
    }
  };

  useEffect(() => {
    updateCursor(tool);
  }, [tool]);

  // Resize canvas to maintain 16:9
  useEffect(() => {
    if (!containerRef.current) return;

    let lastWidth = 0;
    const updateSize = () => {
      if (containerRef.current) {
        // Use getBoundingClientRect for more reliable measurements
        const rect = containerRef.current.getBoundingClientRect();
        const containerWidth = rect.width;
        
        // Only update if width changed significantly (more than 1px difference)
        // This prevents incremental expansion from minor layout recalculations
        if (Math.abs(containerWidth - lastWidth) > 1) {
          lastWidth = containerWidth;
          const width = containerWidth;
          const height = (containerWidth * 9) / 16;
          setStageSize({ width, height });
        }
      }
    };

    // Initial size calculation
    updateSize();

    // Use ResizeObserver for more reliable container size tracking
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use requestAnimationFrame to debounce and avoid multiple rapid updates
        requestAnimationFrame(() => {
          updateSize();
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    // Also listen to window resize as fallback
    window.addEventListener("resize", updateSize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  // Prevent default touch behaviors on the canvas for better stylus support
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent scrolling, zooming, and other gestures while drawing
    const preventDefaultTouchHandler = (e: TouchEvent) => {
      // Only prevent if we're actively drawing or the touch is on the canvas
      if (isDrawingRef.current) {
        e.preventDefault();
      }
    };

    // Prevent context menu on long press (common issue on iPads)
    const preventContextMenu = (e: Event) => {
      if (isDrawingRef.current) {
        e.preventDefault();
      }
    };

    container.addEventListener("touchmove", preventDefaultTouchHandler, { passive: false });
    container.addEventListener("touchstart", preventDefaultTouchHandler, { passive: false });
    container.addEventListener("contextmenu", preventContextMenu);

    return () => {
      container.removeEventListener("touchmove", preventDefaultTouchHandler);
      container.removeEventListener("touchstart", preventDefaultTouchHandler);
      container.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  // Fetch avatars, elements and backgrounds for the selector
  useEffect(() => {
    const fetchAssets = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch avatars
      const { data: avatarsData } = await supabase
        .from("avatars")
        .select("*")
        .order("created_at", { ascending: false });

      if (avatarsData) setUserAvatars(avatarsData);

      // Fetch elements with their images
      const { data: productsData } = await supabase
        .from("products")
        .select(`
          *,
          images:product_images(image_url)
        `)
        .order("created_at", { ascending: false });
      
      if (productsData) setUserElements(productsData);

      // Fetch backgrounds
      const { data: backgroundsData } = await supabase
        .from("backgrounds")
        .select("*")
        .order("created_at", { ascending: false });

      if (backgroundsData) setUserBackgrounds(backgroundsData);
    };

    fetchAssets();
  }, []);

  // Auto-save sketch to local cache to prevent data loss on navigation
  useEffect(() => {
    const saveToCache = () => {
      // Don't save empty default state if there's nothing there
      const hasContent = layers.some(l => l.elements.length > 0) || additionalPrompt.trim() !== "";
      if (!hasContent) return;

      const cacheKey = sketchId ? `sketch-cache-${sketchId}` : "sketch-cache-new";
      const cacheData = {
        layers,
        additionalPrompt,
        sketchName,
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    };

    // Debounce to avoid excessive writes
    const timeoutId = setTimeout(saveToCache, 2000);
    return () => clearTimeout(timeoutId);
  }, [layers, additionalPrompt, sketchName, sketchId]);

  // Get pressure from native event (for Apple Pencil support)
  const getPressureFromEvent = (e: any): number => {
    const nativeEvent = e.evt;
    if (nativeEvent && typeof nativeEvent.pressure === 'number' && nativeEvent.pressure > 0) {
      return nativeEvent.pressure;
    }
    // Default pressure for mouse/touch without pressure support
    return 0.5;
  };

  // Check if input is from a stylus/pen (Apple Pencil)
  const checkIsPenInput = (e: any): boolean => {
    const nativeEvent = e.evt;
    if (nativeEvent) {
      // Check pointer event type
      if (nativeEvent.pointerType === 'pen') return true;
      // Check touch event for Apple Pencil (touchType is 'stylus')
      if (nativeEvent.touches && nativeEvent.touches[0]?.touchType === 'stylus') return true;
    }
    return false;
  };

  // Calculate stroke width based on pressure (for Apple Pencil)
  const getStrokeWidthWithPressure = (baseTool: string, pressure: number): number => {
    const baseWidth = baseTool === "eraser" ? 20 : 5;
    const minWidth = baseTool === "eraser" ? 10 : 1;
    const maxWidth = baseTool === "eraser" ? 40 : 12;
    
    // Map pressure (0-1) to stroke width range
    return minWidth + (maxWidth - minWidth) * pressure;
  };

  const handlePointerDown = (e: any) => {
    // If we click on an empty area, we might want to add a label or text
    if (tool === "label" || tool === "text") {
      // Check if we clicked on an existing text or label element
      // If so, let the element's onClick handler take care of it
      const target = e.target;
      const stage = target.getStage();
      if (target !== stage && target !== stage.findOne("Layer")) {
        // Find if the target or its parent is a text/label element
        let node = target;
        while (node && node !== stage) {
          const id = node.id();
          if (id) {
            const allElements = layers.flatMap(l => l.elements);
            const element = allElements.find(el => el.id === id);
            if (element && (element.type === "text" || element.type === "label")) {
              // Clicked on existing text/label, let its onClick handle it
              return;
            }
          }
          node = node.getParent();
        }
      }

      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Transform coordinates
      const activeLayer = layers.find(l => l.id === activeLayerId);
      let transformPos = pos;
      if (activeLayer) {
        const layerNode = stage.findOne("#" + activeLayerId);
        if (layerNode) {
          const transform = layerNode.getAbsoluteTransform().copy().invert();
          transformPos = transform.point(pos);
        }
      }

      const id = Math.random().toString(36).substr(2, 9);
      saveToUndo();

      if (tool === "label") {
        const newLabel: CanvasElement = {
          type: "label",
          id,
          text: "Label",
          x: transformPos.x,
          y: transformPos.y,
          targetX: transformPos.x + 20,
          targetY: transformPos.y + 20,
        };
        setLayers(layers.map(layer => 
          layer.id === activeLayerId 
            ? { ...layer, elements: [...layer.elements, newLabel] }
            : layer
        ));
      } else {
        const newText: CanvasElement = {
          type: "text",
          id,
          text: "",
          x: transformPos.x,
          y: transformPos.y,
          fontSize: 24,
          fill: "#000000",
          rotation: 0,
        };
        setLayers(layers.map(layer => 
          layer.id === activeLayerId 
            ? { ...layer, elements: [...layer.elements, newText] }
            : layer
        ));
        
        // Keep text tool active and enter inline editing mode for the new text
        setSelectedId(id);
        setActiveLayerId(activeLayerId);
        
        // Calculate position for inline editor after a short delay to ensure the text node is rendered
        setTimeout(() => {
          const stage = stageRef.current;
          if (!stage) return;
          
          const textNode = stage.findOne("#" + id);
          if (!textNode) return;
          
          const absPos = textNode.getAbsolutePosition();
          const stageContainer = stage.container();
          const containerRect = stageContainer.getBoundingClientRect();
          
          setEditingTextId(id);
          setEditingTextPosition({
            x: containerRect.left + absPos.x,
            y: containerRect.top + absPos.y,
            fontSize: newText.fontSize,
            fill: newText.fill,
            rotation: newText.rotation,
          });
          
          // Focus input after it's rendered
          setTimeout(() => {
            textInputRef.current?.focus();
          }, 0);
        }, 0);
        
        return;
      }
      
      // For labels, switch to select tool
      setTool("select");
      setSelectedId(id);
      return;
    }

    if (tool === "select") {
      // Handle deselection when clicking background
      if (e.target === e.target.getStage() || e.target.name() === "background") {
        setSelectedId(null);
      }
      return;
    }

    if (tool === "instructions") {
      // Instructions tool doesn't interact with canvas
      return;
    }
    
    const isPen = checkIsPenInput(e);
    const pressure = getPressureFromEvent(e);
    
    setIsPenInput(isPen);
    setCurrentPressure(pressure);
    setIsDrawing(true);
    isDrawingRef.current = true;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (!pos) return;
    
    // Transform coordinates if the active layer has transformations
    const activeLayer = layers.find(l => l.id === activeLayerId);
    let transformPos = pos;
    
    if (activeLayer) {
      const layerNode = stage.findOne("#" + activeLayerId);
      if (layerNode) {
        const transform = layerNode.getAbsoluteTransform().copy().invert();
        transformPos = transform.point(pos);
      }
    }

    const id = Math.random().toString(36).substr(2, 9);
    
    if (tool === "rectangle" || tool === "circle" || tool === "triangle") {
      const newShape: CanvasElement = {
        type: "shape",
        id,
        shapeType: tool as "rectangle" | "circle" | "triangle",
        x: transformPos.x,
        y: transformPos.y,
        width: 0,
        height: 0,
        stroke: "#000000",
        strokeWidth: 2,
        fill: "transparent",
        rotation: 0,
      };
      
      saveToUndo();
      setLayers(layers.map(layer => 
        layer.id === activeLayerId 
          ? { ...layer, elements: [...layer.elements, newShape] }
          : layer
      ));
      return;
    }

    // Use pressure-sensitive stroke width for pen input
    const strokeWidth = isPen 
      ? getStrokeWidthWithPressure(tool, pressure)
      : (tool === "eraser" ? 20 : 5);
    
    const newLine: CanvasElement = {
      type: "line",
      id,
      tool,
      points: [transformPos.x, transformPos.y],
      stroke: tool === "eraser" ? "#ffffff" : "#000000",
      strokeWidth,
    };
    
    saveToUndo();
    setLayers(layers.map(layer => 
      layer.id === activeLayerId 
        ? { ...layer, elements: [...layer.elements, newLine] }
        : layer
    ));
  };

  const handlePointerMove = (e: any) => {
    // Use ref for more reliable touch tracking
    if (!isDrawing && !isDrawingRef.current) return;
    
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (!pos) return;
    
    // Update pressure for Apple Pencil
    const pressure = getPressureFromEvent(e);
    if (isPenInput && pressure !== currentPressure) {
      setCurrentPressure(pressure);
    }
    
    // Transform coordinates if the active layer has transformations
    const activeLayer = layers.find(l => l.id === activeLayerId);
    let transformPos = pos;
    
    if (activeLayer) {
      const layerNode = stage.findOne("#" + activeLayerId);
      if (layerNode) {
        const transform = layerNode.getAbsoluteTransform().copy().invert();
        transformPos = transform.point(pos);
      }
    }
    
    setLayers(layers.map(layer => {
      if (layer.id !== activeLayerId) return layer;
      
      const newElements = [...layer.elements];
      const lastElement = newElements[newElements.length - 1];
      
      if (!lastElement) return layer;

      if (lastElement.type === "shape") {
        lastElement.width = transformPos.x - lastElement.x;
        lastElement.height = transformPos.y - lastElement.y;
        return { ...layer, elements: newElements };
      }

      if (lastElement.type === "line") {
        if (lastElement.tool === "pencil" || lastElement.tool === "eraser") {
          lastElement.points = lastElement.points.concat([transformPos.x, transformPos.y]);
          
          // Update stroke width based on current pressure for pen input
          if (isPenInput) {
            const newStrokeWidth = getStrokeWidthWithPressure(lastElement.tool, pressure);
            // Smooth transition: blend current and new stroke width
            lastElement.strokeWidth = lastElement.strokeWidth * 0.7 + newStrokeWidth * 0.3;
          }
        } else if (lastElement.tool === "line") {
          lastElement.points = [lastElement.points[0], lastElement.points[1], transformPos.x, transformPos.y];
        }
        return { ...layer, elements: newElements };
      }
      return layer;
    }));
  };

  const handlePointerUp = () => {
    if (isDrawingRef.current) {
      const activeLayer = layers.find(l => l.id === activeLayerId);
      const lastElement = activeLayer?.elements[activeLayer.elements.length - 1];
      if (lastElement && (lastElement.type === "shape" || tool === "label" || tool === "text")) {
        setTool("select");
        setSelectedId(lastElement.id);
        // Force cursor update
        setTimeout(() => updateCursor("select"), 0);
      }
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    setIsPenInput(false);
    setCurrentPressure(0.5);
  };

  const saveToUndo = () => {
    setUndoStack([...undoStack, JSON.parse(JSON.stringify(layers))]);
    setRedoStack([]);
  };

  const handleStageClick = (e: any) => {
    // Exit text editing mode if clicking on stage background
    if (editingTextId && (e.target === e.target.getStage() || e.target.name() === "background")) {
      setEditingTextId(null);
      setEditingTextPosition(null);
    }
    // Selection and creation are now handled in handlePointerDown for better responsiveness on iPad
    // We keep this for any specific click-only logic if needed
    if (e.target === e.target.getStage() || e.target.name() === "background") {
      setSelectedId(null);
    }
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const prev = undoStack.pop()!;
      setRedoStack([...redoStack, JSON.parse(JSON.stringify(layers))]);
      setLayers(prev);
      setUndoStack([...undoStack]);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const next = redoStack.pop()!;
      setUndoStack([...undoStack, JSON.parse(JSON.stringify(layers))]);
      setLayers(next);
      setRedoStack([...redoStack]);
    }
  };

  const handleClear = () => {
    if (window.confirm(t("common.confirm"))) {
      saveToUndo();
      setLayers([{ 
        id: "layer-1", 
        name: "Layer 1", 
        elements: [],
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0
      }]);
      setActiveLayerId("layer-1");
      setSelectedId(null);
      setAdditionalPrompt("");
      
      // Clear cache
      const cacheKey = sketchId ? `sketch-cache-${sketchId}` : "sketch-cache-new";
      localStorage.removeItem(cacheKey);
    }
  };

  const addImageToCanvas = (url: string, type: "avatar" = "avatar", isBackground = false) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const id = Math.random().toString(36).substr(2, 9);
      
      // Calculate aspect ratio
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      const ratio = naturalWidth / naturalHeight;
      
      let width = 200;
      let height = 200 / ratio;
      
      if (isBackground) {
        width = stageSize.width;
        height = stageSize.height;
      } else {
        // Limit initial size but keep aspect ratio
        if (width > stageSize.width * 0.5) {
          width = stageSize.width * 0.5;
          height = width / ratio;
        }
        if (height > stageSize.height * 0.5) {
          height = stageSize.height * 0.5;
          width = height * ratio;
        }
      }

      const newElement: CanvasElement = {
        type: "avatar",
        id,
        url,
        x: isBackground ? 0 : stageSize.width / 2 - width / 2,
        y: isBackground ? 0 : stageSize.height / 2 - height / 2,
        width,
        height,
        rotation: 0,
      };

      saveToUndo();
      setLayers(layers.map(layer => 
        layer.id === activeLayerId 
          ? { 
              ...layer, 
              elements: isBackground 
                ? [newElement, ...layer.elements] 
                : [...layer.elements, newElement] 
            }
          : layer
      ));
      setSelectedId(id);
      setTool("select");
    };
    img.src = url;
  };

  const handleAddAvatar = (url: string) => {
    addImageToCanvas(url);
    setIsAvatarDialogOpen(false);
  };

  const handleAddElement = (url: string) => {
    addImageToCanvas(url);
    setIsAssetsDialogOpen(false);
  };

  const handleUploadImageFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");
      return;
    }

    const loadingToast = toast.loading("Uploading image...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("sketches")
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("sketches")
        .getPublicUrl(fileName);

      addImageToCanvas(publicUrl);
      toast.success("Image added successfully", { id: loadingToast });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload image", { id: loadingToast });
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUploadImageFile(file);
  };

  const handleAddBackground = (background: any) => {
    const meta = (background.metadata as Record<string, any>) || {};
    
    if (background.type === "image" || background.type === "avatar") {
      let url = background.value || meta.imageUrl;
      if (background.type === "avatar") {
        const avatar = userAvatars.find(a => a.id === (background.value || meta.avatarId));
        url = avatar?.image_url;
      }
      
      if (!url) {
        toast.error("Could not find image URL for this background");
        return;
      }

      addImageToCanvas(url, "avatar", true);
    } else if (background.type === "gradient" || background.type === "solid") {
      saveToUndo();
      const id = Math.random().toString(36).substr(2, 9);
      let fill = "#ffffff";
      if (background.type === "solid") {
        fill = background.value || meta.color || "#ffffff";
      } else {
        const colors = (background.value || "").split(',');
        fill = colors[0] || meta.color1 || "#ffffff";
      }
      
      const newBackgroundElement: CanvasElement = {
        type: "shape",
        id,
        shapeType: "rectangle",
        x: 0,
        y: 0,
        width: stageSize.width,
        height: stageSize.height,
        stroke: "transparent",
        strokeWidth: 0,
        fill,
        rotation: 0,
      };
      setLayers(layers.map(layer => 
        layer.id === activeLayerId 
          ? { ...layer, elements: [newBackgroundElement, ...layer.elements] } // Add as background
          : layer
      ));
      setSelectedId(id);
      setTool("select");
    }
    
    setIsAssetsDialogOpen(false);
  };

  const handleAddLayer = () => {
    saveToUndo();
    const id = Math.random().toString(36).substr(2, 9);
    const newLayer: LayerData = {
      id,
      name: `Layer ${layers.length + 1}`,
      elements: [],
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0
    };
    setLayers([...layers, newLayer]);
    setActiveLayerId(id);
    toast.success("New layer created");
  };

  const updateLayer = (id: string, newAttrs: any) => {
    setLayers(layers.map(layer => layer.id === id ? { ...layer, ...newAttrs } : layer));
  };

  const handleGenerate = async () => {
    const visibleLayers = layers.filter(l => l.isVisible !== false);
    const allElements = visibleLayers.flatMap(l => l.elements);
    
    if (allElements.length === 0) {
      toast.error("Add some sketch elements first (on visible layers)");
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Export canvas as base64
      if (!stageRef.current) {
        throw new Error("Stage reference is not available");
      }
      
      // Export sketch as PNG with higher pixel ratio for better quality
      const sketchBase64 = stageRef.current.toDataURL({ pixelRatio: 2 });
      
      // Validate the export worked
      if (!sketchBase64 || !sketchBase64.startsWith("data:")) {
        throw new Error("Failed to export sketch canvas");
      }
      
      console.log("Sketch exported successfully, length:", sketchBase64.length);

      // 2. Prepare generation data
      const labelTexts = allElements
        .filter((el): el is Extract<CanvasElement, { type: "label" | "shape" }> => 
          el.type === "label" || (el.type === "shape" && !!el.text)
        )
        .map(el => el.text!);
      const visualTexts = allElements
        .filter((el): el is Extract<CanvasElement, { type: "text" }> => el.type === "text")
        .map(t => ({ text: t.text, fill: t.fill }));
      const avatarUrls = allElements
        .filter((el): el is Extract<CanvasElement, { type: "avatar" }> => el.type === "avatar")
        .map(a => a.url);
      
      // We'll use the existing generate-thumbnail function
      // but with specialized prompts for the sketch mode
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Prepare default viral guidelines if no specific prompt is provided
      const viralStyleGuidelines = 
        "Viral YouTube look: high contrast, warm key/cool rim lighting, dark/blur background, " +
        "bokeh/flares, clean cutout + strong rim/subject glow, subtle 3D depth, no clutter, mobile-sharp 16:9.";

      const textStyleGuidelines = 
        "Typography: bold condensed ALL-CAPS (Anton/Bebas/Impact vibe), " +
        "high contrast with 3D shadows and glows, readable on mobile.";

      const hasText = visualTexts.length > 0;

      const response = await supabase.functions.invoke("generate-thumbnail", {
        body: {
          thumbnailData: {
            aspectRatio: "16:9",
            visualStyle: "cinematic",
            gridMode: false,
            gridCount: 1,
            resolution: "1K",
            customPrompt: `Create a professional YouTube thumbnail based on the attached sketch-reference.

IMPORTANT: Treat the sketch-reference as a precise layout blueprint. Recreate the scene so it matches the sketch in composition and placement.

SKETCH INTERPRETATION RULES (CRITICAL):
- Do NOT omit any clearly drawn object, symbol, prop, or shape in the sketch, even if it has NO tag/label. Every stroke is intentional.
- If an object is recognizable (e.g. a flag, microphones, lights, icons, signs, sun, etc.), include it in the final image.
- If a drawn object is ambiguous, still include it as a simple realistic prop that matches the shape and position.
- Preserve relative sizes, distances, orientation, and layering (foreground/background) exactly as shown.
- Do NOT re-frame, center, crop out, or move elements from their sketched positions.

LABELS (for understanding only):
The sketch contains labels (tags) that describe some elements: ${labelTexts.join(", ")}.
CRITICAL: These labels must NOT be rendered as text in the thumbnail (unless explicitly listed in TEXT below).
STYLE: Render elements described by labels in a highly realistic and photographic style, unless a different specific artistic style is requested in the guidelines below.

TEXT:
${hasText ? `Include ONLY these text elements exactly: ${visualTexts.map(vt => `"${vt.text}" (color: ${vt.fill})`).join(", ")}. ${textStyleGuidelines} CRITICAL: The color for each text element must be strictly respected and used exactly as specified.` : "CRITICAL: DO NOT add any text overlays, headlines, or labels to the thumbnail."}

QUALITY:
Make it high-impact and professional (YouTube viral look), but keep fidelity to the sketch highest priority.
Style guidelines: ${additionalPrompt || viralStyleGuidelines}.

AVATARS:
If avatars are provided as context images, use them as the main subject and preserve their appearance exactly. remove any background from the avatar in the final image.`,
          },
          contextImageUrls: [sketchBase64, ...avatarUrls],
          contextImageLabels: ["sketch-reference", ...avatarUrls.map((_, i) => `avatar-${i + 1}`)],
          creditsUsed: 1
        }
      });

      if (response.error) throw response.error;

      if (response.data?.imageUrl) {
        // Create a new layer with the generated image
        const newLayerId = Math.random().toString(36).substr(2, 9);
        const generatedLayer: LayerData = {
          id: newLayerId,
          name: `Generated ${layers.filter(l => l.name.startsWith("Generated")).length + 1}`,
          elements: [{
            type: "avatar",
            id: Math.random().toString(36).substr(2, 9),
            url: response.data.imageUrl,
            x: 0,
            y: 0,
            width: stageSize.width,
            height: stageSize.height,
            rotation: 0
          }],
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          isVisible: true
        };
        
        saveToUndo();
        setLayers([...layers, generatedLayer]);
        setActiveLayerId(newLayerId);
        toast.success(t("sketch.success.generated"));
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || t("sketch.errors.failed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const updateElement = (id: string, newAttrs: any) => {
    setLayers(layers.map(layer => ({
      ...layer,
      elements: layer.elements.map(el => el.id === id ? { ...el, ...newAttrs } : el)
    })));
  };

  const deleteElement = (id: string) => {
    saveToUndo();
    // Check if it's a layer
    if (layers.find(l => l.id === id)) {
      if (layers.length > 1) {
        const newLayers = layers.filter(l => l.id !== id);
        setLayers(newLayers);
        if (activeLayerId === id) {
          setActiveLayerId(newLayers[0].id);
        }
        setSelectedId(null);
      } else {
        toast.error("Cannot delete the last layer");
      }
      return;
    }

    // Otherwise it's an element
    setLayers(layers.map(layer => ({
      ...layer,
      elements: layer.elements.filter(el => el.id !== id)
    })));
    setSelectedId(null);
  };

  const duplicateElement = (id: string) => {
    saveToUndo();
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (!activeLayer) return;

    const elementToDuplicate = activeLayer.elements.find(el => el.id === id);
    if (!elementToDuplicate) return;

    const newId = Math.random().toString(36).substr(2, 9);
    const duplicatedElement = JSON.parse(JSON.stringify(elementToDuplicate));
    duplicatedElement.id = newId;
    
    // Offset slightly
    if ('x' in duplicatedElement && 'y' in duplicatedElement) {
      duplicatedElement.x += 20;
      duplicatedElement.y += 20;
    }

    setLayers(layers.map(layer => 
      layer.id === activeLayerId 
        ? { ...layer, elements: [...layer.elements, duplicatedElement] }
        : layer
    ));
    setSelectedId(newId);
  };

  const handleReorder = (newLayers: LayerData[]) => {
    saveToUndo();
    setLayers([...newLayers].reverse());
  };

  const openEditDialog = (id: string, currentText: string, type: string) => {
    let title = "Edit Text";
    if (type === "label") title = "Edit Label";
    if (type === "shape") title = "Add text to shape";
    
    setEditingElement({ id, text: currentText || "", title });
    setIsEditTextDialogOpen(true);
  };

  const handleSaveEditedText = () => {
    if (editingElement) {
      updateElement(editingElement.id, { text: editingElement.text });
      setIsEditTextDialogOpen(false);
      setEditingElement(null);
    }
  };

  // Update instructions input position when tool changes
  useEffect(() => {
    if (tool === "instructions" && instructionsButtonRef.current) {
      const updatePosition = () => {
        const rect = instructionsButtonRef.current?.getBoundingClientRect();
        if (rect) {
          // Center vertically with the button (button height is 36px = h-9)
          const buttonCenterY = rect.top + rect.height / 2;
          const inputHeight = 36; // h-9 = 36px
          setInstructionsInputPos({
            // Store as document coordinates (works even if layout uses transforms)
            x: rect.right + 8 + window.scrollX,
            y: buttonCenterY - inputHeight / 2 + window.scrollY,
          });
        }
      };
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [tool]);

  // Update text input position when editing text or layers change
  useEffect(() => {
    if (editingTextId && stageRef.current) {
      const updateTextPosition = () => {
        const stage = stageRef.current;
        if (!stage) return;
        
        const textNode = stage.findOne("#" + editingTextId);
        if (!textNode) return;
        
        const absPos = textNode.getAbsolutePosition();
        const stageContainer = stage.container();
        const containerRect = stageContainer.getBoundingClientRect();
        
        const textElement = layers.flatMap(l => l.elements).find(el => el.id === editingTextId);
        if (!textElement || textElement.type !== "text") return;
        
        setEditingTextPosition(prev => {
          if (!prev) return null;
          return {
            x: containerRect.left + absPos.x,
            y: containerRect.top + absPos.y,
            fontSize: textElement.fontSize,
            fill: textElement.fill,
            rotation: textElement.rotation,
          };
        });
      };
      
      updateTextPosition();
      // Update position more frequently for smooth tracking
      const interval = setInterval(updateTextPosition, 50);
      return () => clearInterval(interval);
    }
  }, [editingTextId, layers]);

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="max-w-full mx-auto space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate("/sketches")}
              className="shrink-0 h-9 w-9"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("sketch.title")}</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">{t("sketch.subtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveSketch}>
              <Save className="w-4 h-4 mr-2" />
              {t("common.save")}
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t("sketch.clear")}
            </Button>
            <Button 
              disabled={isGenerating} 
              onClick={handleGenerate}
              className="bg-[#FF2D55] hover:bg-[#FF2D55]/90 text-white border-0 shadow-lg hover:shadow-[#FF2D55]/20"
            >
              {isGenerating ? (
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? t("sketch.generating") : t("sketch.generate")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Main Canvas Area */}
          <div className="lg:col-span-4 flex gap-4">
            {/* Toolbar - Left side */}
            <div className="flex flex-col gap-1 p-1 bg-background/80 backdrop-blur-md border border-border rounded-xl shadow-lg h-fit sticky top-20 z-10">
              <ToolbarButton 
                active={tool === "select"} 
                onClick={() => setTool("select")} 
                icon={MousePointer2} 
                title="Select"
              />
              <div className="h-[1px] bg-border mx-1 my-1" />
              <ToolbarButton 
                active={tool === "pencil"} 
                onClick={() => setTool("pencil")} 
                icon={Pencil} 
                title="Pencil"
              />
              <ToolbarButton 
                active={tool === "line"} 
                onClick={() => setTool("line")} 
                icon={Minus} 
                title="Line"
              />
              <div className="h-[1px] bg-border mx-1 my-1" />
              <ToolbarButton 
                active={tool === "rectangle"} 
                onClick={() => setTool("rectangle")} 
                icon={Square} 
                title="Rectangle"
              />
              <ToolbarButton 
                active={tool === "circle"} 
                onClick={() => setTool("circle")} 
                icon={CircleIcon} 
                title="Circle"
              />
              <ToolbarButton 
                active={tool === "triangle"} 
                onClick={() => setTool("triangle")} 
                icon={Triangle} 
                title="Triangle"
              />
              <div className="h-[1px] bg-border mx-1 my-1" />
              <ToolbarButton 
                active={tool === "eraser"} 
                onClick={() => setTool("eraser")} 
                icon={Eraser} 
                title="Eraser"
              />
              <div className="h-[1px] bg-border mx-1 my-1" />
              <ToolbarButton 
                active={tool === "label"} 
                onClick={() => setTool("label")} 
                icon={Tags} 
                title="Label"
              />
              <ToolbarButton 
                active={tool === "text"} 
                onClick={() => setTool("text")} 
                icon={Type} 
                title="Text"
              />
              <div className="h-[1px] bg-border mx-1 my-1" />
              <ToolbarButton 
                ref={instructionsButtonRef}
                active={tool === "instructions"} 
                onClick={toggleInstructionsTool} 
                icon={FileText} 
                title={t("sketch.prompt.label")}
              />
              {createPortal(
                <AnimatePresence>
                  {tool === "instructions" && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="z-[100] flex items-center"
                      style={{ 
                        position: "absolute",
                        left: `${instructionsInputPos.x}px`,
                        top: `${instructionsInputPos.y}px`,
                      }}
                    >
                      <Input
                        placeholder={t("sketch.prompt.placeholder")}
                        value={additionalPrompt}
                        onChange={(e) => setAdditionalPrompt(e.target.value)}
                        className="w-64 h-9 bg-background border border-border rounded-md shadow-xl px-3 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body
              )}
              <div className="h-[1px] bg-border mx-1 my-1" />
              <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                <DialogTrigger asChild>
                  <ToolbarButton active={false} onClick={() => {}} icon={UserIcon} title="Add Avatar" />
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{t("createNew.avatar.selection")}</DialogTitle>
                    <DialogDescription>Select an avatar to add to your sketch.</DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 p-4">
                    {userAvatars.map((avatar) => (
                      <div 
                        key={avatar.id}
                        className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
                        onClick={() => handleAddAvatar(avatar.image_url)}
                      >
                        <img src={avatar.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {userAvatars.length === 0 && (
                      <div className="col-span-full text-center py-8">
                        <p className="text-muted-foreground">{t("createNew.avatar.noAvatars")}</p>
                        <Button 
                          variant="link" 
                          onClick={() => navigate("/avatars")}
                        >
                          {t("avatars.title")}
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <div className="h-[1px] bg-border mx-1 my-1" />
              <Dialog open={isAssetsDialogOpen} onOpenChange={setIsAssetsDialogOpen}>
                <DialogTrigger asChild>
                  <ToolbarButton active={false} onClick={() => {}} icon={ImageIcon} title={t("sketch.assets.title")} />
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>{t("sketch.assets.title")}</DialogTitle>
                    <DialogDescription>{t("sketch.assets.description")}</DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="elements" className="w-full flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-3 shrink-0">
                      <TabsTrigger value="elements">{t("sketch.assets.tabs.elements")}</TabsTrigger>
                      <TabsTrigger value="upload">{t("sketch.assets.tabs.upload")}</TabsTrigger>
                      <TabsTrigger value="backgrounds">{t("sketch.assets.tabs.backgrounds")}</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="elements" className="flex-1 overflow-y-auto min-h-0 pt-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {userElements.map((element) => {
                          const imageUrl = element.images?.[0]?.image_url;
                          return (
                            <div 
                              key={element.id}
                              className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all group relative"
                              onClick={() => imageUrl && handleAddElement(imageUrl)}
                            >
                              <img src={imageUrl || "/placeholder.svg"} alt={element.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] text-white truncate text-center">{element.title}</p>
                              </div>
                            </div>
                          );
                        })}
                        {userElements.length === 0 && (
                          <div className="col-span-full text-center py-8">
                            <p className="text-muted-foreground">{t("sketch.assets.noElements")}</p>
                            <Button variant="link" onClick={() => navigate("/elements")}>
                              {t("products.title")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="upload" className="flex-1 flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="w-10 h-10 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-lg">{t("sketch.assets.uploadButton")}</p>
                        <p className="text-sm text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                      </div>
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="asset-upload"
                        onChange={handleUploadImage}
                      />
                      <Button asChild>
                        <label htmlFor="asset-upload" className="cursor-pointer">
                          {t("sketch.assets.uploadButton")}
                        </label>
                      </Button>
                    </TabsContent>

                    <TabsContent value="backgrounds" className="flex-1 overflow-y-auto min-h-0 pt-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                        {userBackgrounds.map((bg) => {
                          const meta = (bg.metadata as Record<string, any>) || {};
                          let previewContent;

                          if (bg.type === "image") {
                            const imageUrl = bg.value || meta.imageUrl;
                            previewContent = <img src={imageUrl} alt={bg.name} className="w-full h-full object-cover" />;
                          } else if (bg.type === "avatar") {
                            const avatar = userAvatars.find(a => a.id === (bg.value || meta.avatarId));
                            const imageUrl = avatar?.image_url || "";
                            previewContent = imageUrl ? <img src={imageUrl} alt={bg.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center"><ImageIcon className="w-6 h-6 text-muted-foreground/20" /></div>;
                          } else if (bg.type === "solid") {
                            const color = bg.value || meta.color || "#ffffff";
                            previewContent = <div style={{ backgroundColor: color }} className="w-full h-full" />;
                          } else if (bg.type === "gradient") {
                            const colors = (bg.value || "").split(',');
                            const c1 = colors[0] || meta.color1 || "#ffffff";
                            const c2 = colors[1] || meta.color2 || "#ffffff";
                            previewContent = <div style={{ background: `linear-gradient(45deg, ${c1}, ${c2})` }} className="w-full h-full" />;
                          } else {
                            previewContent = <div className="w-full h-full bg-muted flex items-center justify-center p-2 text-[8px] text-center overflow-hidden">{bg.value || meta.prompt}</div>;
                          }

                          return (
                            <div 
                              key={bg.id}
                              className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all group relative border border-border"
                              onClick={() => handleAddBackground(bg)}
                            >
                              {previewContent}
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] text-white truncate text-center">{bg.name}</p>
                              </div>
                            </div>
                          );
                        })}
                        {userBackgrounds.length === 0 && (
                          <div className="col-span-full text-center py-8">
                            <p className="text-muted-foreground">{t("sketch.assets.noBackgrounds")}</p>
                            <Button variant="link" onClick={() => navigate("/backgrounds")}>
                              {t("backgrounds.title")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
              <div className="h-[1px] bg-border mx-1 my-1" />
              <ToolbarButton active={false} onClick={handleUndo} icon={Undo} title="Undo" />
              <ToolbarButton active={false} onClick={handleRedo} icon={Redo} title="Redo" />
            </div>

            <div className="flex-1 space-y-4 min-w-0">
              <div 
                ref={containerRef}
                className={`relative bg-white rounded-xl shadow-xl overflow-hidden border-4 border-muted transition-colors ${getCursorClass()}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.add("border-primary");
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-primary");
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.classList.remove("border-primary");
                  
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) {
                    await handleUploadImageFile(file);
                  }
                }}
                style={{ 
                  aspectRatio: "16/9",
                  maxWidth: "100%",
                  // Prevent default touch behaviors for better Apple Pencil/stylus support
                  touchAction: "none",
                  // Prevent text selection while drawing
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              >
                <Stage
                  width={stageSize.width}
                  height={stageSize.height}
                  // Unified pointer events for mouse, touch, and pen
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  // Handle single tap/click for deselection
                  onClick={handleStageClick}
                  onTap={handleStageClick}
                  onDblClick={(e) => {
                    const target = e.target;
                    const stage = target.getStage();
                    if (target === stage) return;
                    
                    let node = target;
                    while (node && !node.id() && node.getParent()) {
                      node = node.getParent();
                    }

                    const id = node?.id();
                    if (!id) return;

                    const allElements = layers.flatMap(l => l.elements);
                    const element = allElements.find(el => el.id === id);

                    if (element && (element.type === "text" || element.type === "label" || element.type === "shape")) {
                      openEditDialog(id, (element as any).text, element.type);
                    }
                  }}
                  onDblTap={(e) => {
                    const target = e.target;
                    const stage = target.getStage();
                    if (target === stage) return;
                    
                    let node = target;
                    while (node && !node.id() && node.getParent()) {
                      node = node.getParent();
                    }

                    const id = node?.id();
                    if (!id) return;

                    const allElements = layers.flatMap(l => l.elements);
                    const element = allElements.find(el => el.id === id);

                    if (element && (element.type === "text" || element.type === "label" || element.type === "shape")) {
                      openEditDialog(id, (element as any).text, element.type);
                    }
                  }}
                  ref={stageRef}
                >
                  <Layer>
                    {/* Background Rect to ensure white background on export */}
                    <Rect 
                      name="background"
                      width={stageSize.width} 
                      height={stageSize.height} 
                      fill="#ffffff" 
                    />
                    
                    {layers.map((layer) => (
                      <Group 
                        key={layer.id} 
                        id={layer.id}
                        visible={layer.isVisible !== false}
                        x={layer.x}
                        y={layer.y}
                        scaleX={layer.scaleX}
                        scaleY={layer.scaleY}
                        rotation={layer.rotation}
                        draggable={tool === "select" && selectedId === layer.id}
                        onClick={(e) => {
                          if (tool === "select") {
                            // Find if we clicked on an element with an ID (not the layer itself)
                            let target = e.target;
                            let elementId = "";
                            
                            // Traverse up to find an ID that belongs to an element in this layer
                            const layerElementIds = layer.elements.map(el => el.id);
                            
                            while (target && target !== e.currentTarget) {
                              if (layerElementIds.includes(target.id())) {
                                elementId = target.id();
                                break;
                              }
                              target = target.getParent();
                            }
                            
                            // Only select layer if we didn't click on a specific sub-element 
                            if (!elementId) {
                              setSelectedId(layer.id);
                              setActiveLayerId(layer.id);
                            }
                          }
                        }}
                        onTap={(e) => {
                          if (tool === "select") {
                            let target = e.target;
                            let elementId = "";
                            const layerElementIds = layer.elements.map(el => el.id);
                            
                            while (target && target !== e.currentTarget) {
                              if (layerElementIds.includes(target.id())) {
                                elementId = target.id();
                                break;
                              }
                              target = target.getParent();
                            }
                            
                            if (!elementId) {
                              setSelectedId(layer.id);
                              setActiveLayerId(layer.id);
                            }
                          }
                        }}
                        onDragEnd={(e) => {
                          if (e.target === e.currentTarget) {
                            updateLayer(layer.id, {
                              x: e.target.x(),
                              y: e.target.y(),
                            });
                          }
                        }}
                        onTransformEnd={(e) => {
                          if (e.target === e.currentTarget) {
                            const node = e.target;
                            updateLayer(layer.id, {
                              x: node.x(),
                              y: node.y(),
                              rotation: node.rotation(),
                              scaleX: node.scaleX(),
                              scaleY: node.scaleY(),
                            });
                          }
                        }}
                      >
                        {layer.elements.map((el) => {
                          if (el.type === "line") {
                            return (
                              <Line
                                key={el.id}
                                id={el.id}
                                points={el.points}
                                stroke={el.stroke}
                                strokeWidth={el.strokeWidth}
                                tension={0.5}
                                lineCap="round"
                                lineJoin="round"
                                globalCompositeOperation={
                                  el.tool === "eraser" ? "destination-out" : "source-over"
                                }
                                hitStrokeWidth={20} // Make it easier to select lines
                              />
                            );
                          }
                          if (el.type === "avatar") {
                            return (
                              <AvatarImage
                                key={el.id}
                                avatar={el}
                                isSelected={el.id === selectedId}
                                onSelect={(e: any) => {
                              if (e) e.cancelBubble = true;
                              setSelectedId(el.id);
                              setTool("select");
                              setActiveLayerId(layer.id);
                            }}
                                onChange={(newAttrs: any) => updateElement(el.id, newAttrs)}
                                tool={tool}
                              />
                            );
                          }
                        if (el.type === "label") {
                          return (
                            <SketchLabelElement
                              key={el.id}
                              label={el}
                              isSelected={el.id === selectedId}
                              onSelect={(e: any) => {
                                if (e) e.cancelBubble = true;
                                // If label tool is active, open edit dialog directly
                                if (tool === "label") {
                                  openEditDialog(el.id, el.text, "label");
                                  setSelectedId(el.id);
                                  setActiveLayerId(layer.id);
                                } else {
                                  setSelectedId(el.id);
                                  setTool("select");
                                  setActiveLayerId(layer.id);
                                }
                              }}
                              onChange={(newAttrs: any) => updateElement(el.id, newAttrs)}
                              onEdit={() => openEditDialog(el.id, el.text, "label")}
                              tool={tool}
                            />
                          );
                        }
                        if (el.type === "text") {
                          return (
                            <TextElementComponent
                              key={el.id}
                              textElement={el}
                              isSelected={el.id === selectedId}
                              isEditing={editingTextId === el.id}
                              onSelect={(e: any) => {
                                if (e) e.cancelBubble = true;
                                // If text tool is active, enter inline editing mode
                                if (tool === "text") {
                                  const stage = e.target.getStage();
                                  const textNode = e.target;
                                  
                                  // Get bounding box of text node in screen coordinates
                                  const box = textNode.getClientRect();
                                  
                                  // Get stage container position
                                  const stageContainer = stage.container();
                                  const containerRect = stageContainer.getBoundingClientRect();
                                  
                                  // Calculate position considering stage position
                                  const absPos = textNode.getAbsolutePosition();
                                  
                                  setEditingTextId(el.id);
                                  setEditingTextPosition({
                                    x: containerRect.left + absPos.x,
                                    y: containerRect.top + absPos.y,
                                    fontSize: el.fontSize,
                                    fill: el.fill,
                                    rotation: el.rotation,
                                  });
                                  setSelectedId(el.id);
                                  setActiveLayerId(layer.id);
                                  
                                  // Focus input after a short delay to ensure it's rendered
                                  setTimeout(() => {
                                    textInputRef.current?.focus();
                                    textInputRef.current?.select();
                                  }, 0);
                                } else {
                                  setSelectedId(el.id);
                                  setTool("select");
                                  setActiveLayerId(layer.id);
                                }
                              }}
                              onChange={(newAttrs: any) => updateElement(el.id, newAttrs)}
                              onEdit={() => openEditDialog(el.id, el.text, "text")}
                              tool={tool}
                            />
                          );
                        }
                        if (el.type === "shape") {
                          return (
                            <ShapeElement
                              key={el.id}
                              shape={el}
                              isSelected={el.id === selectedId}
                              onSelect={(e: any) => {
                                if (e) e.cancelBubble = true;
                                setSelectedId(el.id);
                                setTool("select");
                                setActiveLayerId(layer.id);
                              }}
                              onChange={(newAttrs: any) => updateElement(el.id, newAttrs)}
                              onEdit={() => openEditDialog(el.id, el.text || "", "shape")}
                              tool={tool}
                            />
                          );
                        }
                          return null;
                        })}
                      </Group>
                    ))}
                    
                    <SelectionTransformer 
                      selectedId={selectedId} 
                      layers={layers}
                      onEdit={openEditDialog}
                    />
                  </Layer>
                </Stage>

                {/* Inline text editor */}
                {editingTextId && editingTextPosition && (() => {
                  const textElement = layers.flatMap(l => l.elements).find(el => el.id === editingTextId);
                  if (!textElement || textElement.type !== "text") return null;
                  
                  // Calculate approximate width based on text length and font size
                  const textWidth = Math.max(100, (textElement.text.length || 10) * editingTextPosition.fontSize * 0.6);
                  
                  return (
                    <input
                      ref={textInputRef}
                      type="text"
                      value={textElement.text}
                      onChange={(e) => {
                        updateElement(editingTextId, { text: e.target.value });
                      }}
                      onBlur={() => {
                        setEditingTextId(null);
                        setEditingTextPosition(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          textInputRef.current?.blur();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingTextId(null);
                          setEditingTextPosition(null);
                        }
                        // Prevent event bubbling to stage
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      style={{
                        position: "fixed",
                        left: `${editingTextPosition.x}px`,
                        top: `${editingTextPosition.y}px`,
                        fontSize: `${editingTextPosition.fontSize}px`,
                        color: editingTextPosition.fill,
                        background: "rgba(255, 255, 255, 0.9)",
                        border: "2px solid #3b82f6",
                        borderRadius: "2px",
                        outline: "none",
                        padding: "2px 4px",
                        margin: "-2px -4px",
                        transform: `rotate(${editingTextPosition.rotation}deg)`,
                        transformOrigin: "top left",
                        width: `${textWidth}px`,
                        fontFamily: "inherit",
                        fontWeight: "inherit",
                        lineHeight: "1.2",
                        zIndex: 10000,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                      }}
                    />
                  );
                })()}

                <SelectionActions 
                  selectedId={selectedId}
                  stageRef={stageRef}
                  layers={layers}
                  onDelete={deleteElement}
                  onDuplicate={duplicateElement}
                  onEdit={openEditDialog}
                />
              </div>
            </div>
          </div>

          {/* Side Panel: Properties and Layers */}
          <div className="flex flex-col gap-6 h-[calc(100vh-10rem)]">
            {/* Properties Section (only if selected) */}
            {selectedId && (
              <div className="bg-card border border-border rounded-xl p-4 shrink-0 overflow-visible">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4" />
                  Properties
                </h3>
                
                {layers.find(l => l.id === selectedId) && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Layer Name</Label>
                      <Input 
                        value={layers.find(l => l.id === selectedId)!.name}
                        onChange={(e) => updateLayer(selectedId, { name: e.target.value })}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        saveToUndo();
                        updateLayer(selectedId, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
                      }}
                    >
                      Reset Transformation
                    </Button>
                  </div>
                )}

                {layers.flatMap(l => l.elements).find(el => el.id === selectedId)?.type === "label" && (
                  <div className="space-y-2">
                    <Label>Label Text</Label>
                    <Input 
                      value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).text}
                      onChange={(e) => updateElement(selectedId, { text: e.target.value })}
                    />
                  </div>
                )}

                {layers.flatMap(l => l.elements).find(el => el.id === selectedId)?.type === "text" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Text Content</Label>
                      <Input 
                        value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).text}
                        onChange={(e) => updateElement(selectedId, { text: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Font Size</Label>
                      <Input 
                        type="number"
                        value={Math.round((layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).fontSize)}
                        onChange={(e) => updateElement(selectedId, { fontSize: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Text Color</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="color"
                          className="w-10 h-10 p-1 bg-transparent cursor-pointer"
                          value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).fill || "#000000"}
                          onChange={(e) => updateElement(selectedId, { fill: e.target.value })}
                        />
                        <Input 
                          type="text"
                          className="flex-1"
                          value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).fill || "#000000"}
                          onChange={(e) => updateElement(selectedId, { fill: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {layers.flatMap(l => l.elements).find(el => el.id === selectedId)?.type === "shape" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Shape Text (Label/Tag)</Label>
                      <Input 
                        value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).text || ""}
                        onChange={(e) => updateElement(selectedId, { text: e.target.value })}
                        placeholder="Tag this element (e.g. 'Red car', 'Microphone')..."
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Text in shapes is used as a label for the AI and won't appear as text in the thumbnail.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Shape Fill Color</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="color"
                          className="w-10 h-10 p-1 bg-transparent cursor-pointer"
                          value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).fill || "transparent"}
                          onChange={(e) => updateElement(selectedId, { fill: e.target.value })}
                        />
                        <Input 
                          type="text"
                          className="flex-1"
                          value={(layers.flatMap(l => l.elements).find(el => el.id === selectedId) as any).fill || "transparent"}
                          onChange={(e) => updateElement(selectedId, { fill: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full mt-4"
                  onClick={() => deleteElement(selectedId)}
                >
                  {layers.find(l => l.id === selectedId) ? "Delete Layer" : "Delete Element"}
                </Button>
              </div>
            )}

            {/* Layers Section (always visible) */}
            <div className="bg-card border border-border rounded-xl p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2 shrink-0">
                  <LayersIcon className="w-4 h-4" />
                  Layers
                </h3>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10" 
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        toast.error("Not authenticated");
                        return;
                      }

                      const loadingToast = toast.loading("Saving thumbnail...");
                      try {
                        // Export canvas
                        const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
                        const base64 = dataUrl.split(",")[1];
                        const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

                        // Upload to storage
                        const fileName = `${user.id}/${Date.now()}.png`;
                        const { error: uploadError } = await supabase.storage
                          .from("thumbnails")
                          .upload(fileName, binaryData, { contentType: "image/png" });
                        
                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                          .from("thumbnails")
                          .getPublicUrl(fileName);

                        // Insert into thumbnails table
                        const { error: insertError } = await supabase.from("thumbnails").insert({
                          user_id: user.id,
                          image_url: publicUrl,
                          title: "",
                          subtitle: "",
                          visual_style: "Sketch to Thumbnail",
                          text_style: "Sketch to Thumbnail",
                          background_type: "generated",
                          aspect_ratio: "16:9",
                        });

                        if (insertError) throw insertError;

                        toast.success("Thumbnail saved to library!", {
                          id: loadingToast,
                          action: {
                            label: "View",
                            onClick: () => navigate("/dashboard")
                          }
                        });
                      } catch (err: any) {
                        console.error("Save error:", err);
                        toast.error(err.message || "Failed to save thumbnail", { id: loadingToast });
                      }
                    }}
                    title="Save current result to library"
                  >
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAddLayer}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-1">
                <Reorder.Group 
                  axis="y" 
                  values={[...layers].reverse()} 
                  onReorder={handleReorder}
                  className="space-y-2"
                >
                  {[...layers].reverse().map((layer) => (
                    <Reorder.Item 
                      key={layer.id} 
                      value={layer}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors group relative m-0.5 ${
                        activeLayerId === layer.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                      } ${selectedId === layer.id ? "ring-2 ring-primary" : ""}`}
                        onClick={() => {
                          setActiveLayerId(layer.id);
                          setSelectedId(layer.id);
                        }}
                      >
                      <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />
                      
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden border border-border/50">
                        <LayersIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {layer.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {layer.elements.length} elements
                        </p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newLayers = layers.map(l => 
                            l.id === layer.id ? { ...l, isVisible: l.isVisible === false } : l
                          );
                          setLayers(newLayers);
                        }}
                      >
                        {layer.isVisible !== false ? (
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-muted-foreground/50" />
                        )}
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (layers.length > 1) {
                            saveToUndo();
                            setLayers(layers.filter(l => l.id !== layer.id));
                            if (activeLayerId === layer.id) {
                              setActiveLayerId(layers.find(l => l.id !== layer.id)!.id);
                            }
                          } else {
                            toast.error("Cannot delete the last layer");
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </Reorder.Item>
                  ))}
                  {layers.length === 0 && (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">No layers yet.</p>
                  )}
                </Reorder.Group>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Text Dialog */}
      <Dialog open={isEditTextDialogOpen} onOpenChange={setIsEditTextDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingElement?.title}</DialogTitle>
            <DialogDescription>Modify the content of the selected element.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Text content</Label>
              <Input 
                value={editingElement?.text || ""} 
                onChange={(e) => setEditingElement(prev => prev ? { ...prev, text: e.target.value } : null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveEditedText();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditTextDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEditedText}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cloud Save Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sketches.saveCloud")}</DialogTitle>
            <DialogDescription>
              {t("sketches.saveCloudDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t("sketches.sketchName")}</Label>
              <Input 
                value={sketchName} 
                onChange={(e) => setSketchName(e.target.value)}
                placeholder={t("sketches.sketchPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveToCloud();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveToCloud} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("sketches.saving")}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {t("sketches.saveButton")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ToolbarButton = React.forwardRef<HTMLButtonElement, { active: boolean; onClick?: () => void; icon: any; title?: string }>(
  ({ active, onClick, icon: Icon, title }, ref) => (
    <Button
      ref={ref}
      variant={active ? "secondary" : "ghost"}
      size="icon"
      onClick={onClick}
      className={`h-9 w-9 rounded-full ${active ? "bg-primary/20 text-primary" : ""}`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </Button>
  )
);
ToolbarButton.displayName = "ToolbarButton";

const AvatarImage = ({ avatar, isSelected, onSelect, onChange, tool }: any) => {
  // Use crossOrigin="anonymous" to prevent canvas tainting when exporting
  const [img] = useImage(avatar.url, "anonymous");
  const shapeRef = useRef<any>();

  const handleMouseEnter = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "grab";
    }
  };

  const handleMouseLeave = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "default";
    }
  };

  return (
    <Group
      x={avatar.x}
      y={avatar.y}
      id={avatar.id}
      draggable={tool === "select" && isSelected}
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        stage.container().style.cursor = "grabbing";
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        stage.container().style.cursor = "grab";
        onChange({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: avatar.width * node.scaleX(),
          height: avatar.height * node.scaleY(),
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    >
      {img && (
        <KonvaImage
          image={img}
          width={avatar.width}
          height={avatar.height}
          stroke={isSelected ? "#3b82f6" : "transparent"}
          strokeWidth={2}
          ref={shapeRef}
        />
      )}
    </Group>
  );
};

const SketchLabelElement = ({ label, isSelected, onSelect, onChange, onEdit, tool }: any) => {
  const textRef = useRef<any>(null);
  const [textHeight, setTextHeight] = useState(20);

  useEffect(() => {
    if (textRef.current) {
      setTextHeight(textRef.current.height());
    }
  }, [label.text]);

  const handleMouseEnter = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "grab";
    }
  };

  const handleMouseLeave = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "default";
    }
  };

  const handleDblClick = (e: any) => {
    if (e) e.cancelBubble = true;
    if (onEdit) onEdit();
  };

  return (
    <Group
      draggable={tool === "select" && isSelected}
      x={label.x}
      y={label.y}
      id={label.id}
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        stage.container().style.cursor = "grabbing";
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        stage.container().style.cursor = "grab";
        onChange({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
    >
      <Arrow
        points={[0, 0, label.targetX - label.x, label.targetY - label.y]}
        pointerLength={10}
        pointerWidth={10}
        fill="#000000"
        stroke="#000000"
        strokeWidth={2}
      />
      <Rect
        x={-50}
        y={-textHeight - 5}
        width={100}
        height={textHeight}
        fill={isSelected ? "#3b82f6" : "#ffffff"}
        stroke="#000000"
        strokeWidth={1}
        cornerRadius={4}
      />
      <Text
        ref={textRef}
        x={-50}
        y={-textHeight - 5}
        width={100}
        padding={5}
        text={label.text}
        fontSize={12}
        align="center"
        fill={isSelected ? "#ffffff" : "#000000"}
        wrap="word"
      />
    </Group>
  );
};

const TextElementComponent = ({ textElement, isSelected, isEditing, onSelect, onChange, onEdit, tool }: any) => {
  const handleMouseEnter = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "grab";
    } else if (tool === "text") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "text";
    }
  };

  const handleMouseLeave = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "default";
    } else if (tool === "text") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "default";
    }
  };

  const handleDblClick = (e: any) => {
    if (e) e.cancelBubble = true;
    if (onEdit) onEdit();
  };

  return (
    <Text
      text={textElement.text}
      x={textElement.x}
      y={textElement.y}
      id={textElement.id}
      fontSize={textElement.fontSize}
      fill={textElement.fill}
      rotation={textElement.rotation}
      draggable={tool === "select" && isSelected && !isEditing}
      opacity={isEditing ? 0 : 1}
      onClick={(e) => onSelect(e)}
      onTap={(e) => onSelect(e)}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        stage.container().style.cursor = "grabbing";
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        stage.container().style.cursor = "grab";
        onChange({
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "grabbing";
      }}
      onTransformEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
        
        const node = e.target;
        onChange({
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          fontSize: textElement.fontSize * node.scaleX(),
        });
        node.scaleX(1);
        node.scaleY(1);
      }}
    />
  );
};

const SelectionTransformer = ({ selectedId, layers, onEdit }: any) => {
  const trRef = useRef<any>();

  useEffect(() => {
    if (selectedId) {
      const stage = trRef.current?.getStage();
      const selectedNode = stage.findOne("#" + selectedId);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      } else {
        trRef.current.nodes([]);
      }
    } else {
      trRef.current.nodes([]);
    }
  }, [selectedId, layers]);

  return (
    <Transformer
      ref={trRef}
      rotationCursor="pointer"
      onDblClick={(e) => {
        // If we double click the transformer, try to edit the selected node
        const stage = e.target.getStage();
        const selectedNode = stage.findOne("#" + selectedId);
        if (selectedNode) {
          const id = selectedNode.id();
          const allElements = layers.flatMap(l => l.elements);
          const element = allElements.find(el => el.id === id);

          if (element && (element.type === "text" || element.type === "label" || element.type === "shape")) {
            onEdit(id, (element as any).text, element.type);
          }
        }
      }}
      onDblTap={(e) => {
        const stage = e.target.getStage();
        const selectedNode = stage.findOne("#" + selectedId);
        if (selectedNode) {
          const id = selectedNode.id();
          const allElements = layers.flatMap(l => l.elements);
          const element = allElements.find(el => el.id === id);

          if (element && (element.type === "text" || element.type === "label" || element.type === "shape")) {
            onEdit(id, (element as any).text, element.type);
          }
        }
      }}
      onTransformStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "grabbing";
      }}
      onTransformEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = "default";
      }}
      boundBoxFunc={(oldBox, newBox) => {
        if (newBox.width < 5 || newBox.height < 5) {
          return oldBox;
        }
        return newBox;
      }}
    />
  );
};

const ShapeElement = ({ shape, isSelected, onSelect, onChange, onEdit, tool }: any) => {
  const handleMouseEnter = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "grab";
    }
  };

  const handleMouseLeave = (e: any) => {
    if (tool === "select") {
      const stage = e.target.getStage();
      stage.container().style.cursor = "default";
    }
  };

  const handleDblClick = (e: any) => {
    if (e) e.cancelBubble = true;
    if (onEdit) onEdit();
  };

  const commonProps = {
    draggable: tool === "select" && isSelected,
    onClick: onSelect,
    onTap: onSelect,
    onDblClick: handleDblClick,
    onDblTap: handleDblClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onDragEnd: (e: any) => {
      onChange({
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    onTransformEnd: (e: any) => {
      const node = e.target;
      onChange({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: shape.width * node.scaleX(),
        height: shape.height * node.scaleY(),
      });
      node.scaleX(1);
      node.scaleY(1);
    },
  };

  const renderShape = () => {
    if (shape.shapeType === "rectangle") {
      return (
        <Rect
          x={0}
          y={0}
          width={shape.width}
          height={shape.height}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          fill={shape.fill}
        />
      );
    }

    if (shape.shapeType === "circle") {
      return (
        <Ellipse
          x={shape.width / 2}
          y={shape.height / 2}
          radiusX={Math.abs(shape.width / 2)}
          radiusY={Math.abs(shape.height / 2)}
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          fill={shape.fill}
        />
      );
    }

    if (shape.shapeType === "triangle") {
      return (
        <Line
          x={0}
          y={0}
          points={[
            shape.width / 2, 0,
            shape.width, shape.height,
            0, shape.height,
          ]}
          closed
          stroke={shape.stroke}
          strokeWidth={shape.strokeWidth}
          fill={shape.fill}
        />
      );
    }
    return null;
  };

  return (
    <Group
      x={shape.x}
      y={shape.y}
      id={shape.id}
      rotation={shape.rotation}
      {...commonProps}
    >
      {renderShape()}
      {shape.text && (
        <Group x={0} y={0}>
          <Rect
            x={shape.width / 2 - Math.min(50, shape.width / 2)}
            y={shape.height / 2 - 10}
            width={Math.min(100, shape.width)}
            height={20}
            fill="#000000"
            cornerRadius={4}
            opacity={0.8}
          />
          <Text
            text={shape.text}
            width={shape.width}
            height={shape.height}
            align="center"
            verticalAlign="middle"
            fontSize={Math.max(8, Math.min(11, shape.width / 5))}
            fill="#ffffff"
            padding={2}
            fontStyle="bold"
          />
        </Group>
      )}
    </Group>
  );
};

const SelectionActions = ({ selectedId, stageRef, layers, onDelete, onDuplicate, onEdit }: any) => {
  const [pos, setPos] = useState({ x: 0, y: 0, width: 0 });

  useEffect(() => {
    if (!selectedId || !stageRef.current) return;

    const updatePos = () => {
      const node = stageRef.current.findOne("#" + selectedId);
      if (node) {
        const box = node.getClientRect();
        const stageBox = stageRef.current.container().getBoundingClientRect();
        setPos({
          x: stageBox.left + box.x,
          y: stageBox.top + box.y + box.height,
          width: box.width,
        });
      }
    };

    updatePos();
    const interval = setInterval(updatePos, 16); // Sync with animation frame
    return () => clearInterval(interval);
  }, [selectedId, stageRef]);

  if (!selectedId) return null;

  // Check if selected element is a shape with text capability
  const allElements = layers.flatMap(l => l.elements);
  const selectedElement = allElements.find(el => el.id === selectedId);
  const isShape = selectedElement?.type === "shape";

  return (
    <div 
      className="fixed z-50 flex gap-1 p-1 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-xl -translate-x-1/2"
      style={{ 
        left: pos.x + pos.width / 2,
        top: pos.y + 10,
      }}
    >
      {isShape && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-muted-foreground hover:text-primary"
          onClick={() => onEdit(selectedId, (selectedElement as any).text || "", "shape")}
          title="Edit Text"
        >
          <Edit className="w-4 h-4" />
        </Button>
      )}
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-primary"
        onClick={() => onDuplicate(selectedId)}
        title="Duplicate"
      >
        <Copy className="w-4 h-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(selectedId)}
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default SketchToThumbnail;
