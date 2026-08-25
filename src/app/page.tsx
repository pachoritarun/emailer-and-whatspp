"use client";

import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Mail, Settings, Users, FileSpreadsheet, Play, CheckCircle,
  XCircle, Download, Eye, Sparkles, Server, Key, User, ShieldCheck,
  Zap, RefreshCw, EyeOff, Tag, Search, Filter, GraduationCap, Building2,
  BookOpen, Layers, Check, Sun, Moon, HelpCircle, X, Info, ArrowRight,
  Clock, Activity, AlertTriangle, ShieldAlert, Cpu, Lock, ChevronRight,
  Trash2, Plus, Send, Database, History, Smartphone, UserPlus
} from "lucide-react";
import toast from "react-hot-toast";

type StudentData = {
  name?: string;
  email?: string;
  rollNumber?: string;
  id?: string;
  password?: string;
  [key: string]: any;
};

const maskPhoneNumber = (num: string) => {
  if (!num) return "-";
  const clean = num.replace(/\D/g, "");
  if (clean.length < 5) return "****";
  return clean.slice(0, 2) + "******" + clean.slice(-3);
};

const maskEmailAddress = (email: string) => {
  if (!email || !email.includes("@")) return email;
  const [user, domain] = email.split("@");
  if (user.length <= 2) return "**@" + domain;
  return user.slice(0, 1) + "***" + user.slice(-1) + "@" + domain;
};

export default function Dashboard() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [data, setData] = useState<StudentData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "success" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedField, setFocusedField] = useState<"subject" | "body">("body");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideStep, setGuideStep] = useState<number>(1);

  // Default Port 465 (SSL Encrypted)
  const [smtpConfig, setSmtpConfig] = useState({
    host: "smtp.gmail.com",
    port: 465,
    user: "admin@jecrcu.edu.in",
    pass: "",
    from: "JECRC University Administration <admin@jecrcu.edu.in>",
  });

  const [emailTemplate, setEmailTemplate] = useState({
    subject: "JECRC University - Academic Portal Access Credentials for {{name}}",
    body: "Dear {{name}},\n\nGreetings from JECRC University Administration.\n\nYour official student registration and portal access credentials for the academic session are detailed below:\n\nâ€¢ Student Name: {{name}}\nâ€¢ Roll Number: {{rollNumber}}\nâ€¢ Student ID: {{id}}\nâ€¢ Portal Login Email: {{email}}\nâ€¢ Temporary Password: {{password}}\n\nPlease log in to the official JECRC Student Portal (https://portal.jecrcu.edu.in) to reset your password and complete your registration.\n\nFor any academic queries, contact academics@jecrcu.edu.in.\n\nWarm regards,\nOffice of Academic Affairs\nJECRC University, Jaipur",
  });

  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [startTime, setStartTime] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  // ==========================================
  // DIRECTORY & BROADCAST STATES & UTILITIES
  // ==========================================
  const [dashboardTab, setDashboardTab] = useState<"campaign" | "directory">("campaign");
  const [selectedRoleGroup, setSelectedRoleGroup] = useState<"Faculty" | "Student" | "Alumni" | "Custom" | "Spreadsheet">("Faculty");
  const [dbContacts, setDbContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Record<string | number, boolean>>({});
  const [importRole, setImportRole] = useState<"Faculty" | "Student" | "Alumni">("Student");
  
  // Custom number input states
  const [customContact, setCustomContact] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Broadcast settings
  const [broadcastMessage, setBroadcastMessage] = useState(
    "Dear {{name}},\n\nGreetings from JECRC University.\n\nThis is an official utility message.\n\nWarm regards,\nJECRC University"
  );
  const [broadcastSubject, setBroadcastSubject] = useState("Official Notification from JECRC University");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  
  // Broadcast history & states
  const [broadcastLogs, setBroadcastLogs] = useState<any[]>([]);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState({ sent: 0, total: 0 });
  const [broadcastResults, setBroadcastResults] = useState<any[]>([]);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  // Template Mode States
  const [useTemplate, setUseTemplate] = useState(true);
  const [metaTemplates, setMetaTemplates] = useState<{name:string;language:string;body:string;variableCount:number}[]>([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<{name:string;language:string;body:string;variableCount:number}|null>(null);
  const [templateVarValues, setTemplateVarValues] = useState<string[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string|null>(null);
  const [broadcastJobStats, setBroadcastJobStats] = useState<{total:number;sent:number;failed:number;pending:number}|null>(null);
  // Local Template Form States
  const [showAddTemplateForm, setShowAddTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateLang, setNewTemplateLang] = useState("en_US");
  const [newTemplateBody, setNewTemplateBody] = useState("");

  // Fetch contacts based on role
  const fetchContacts = async (role: string) => {
    try {
      const res = await fetch(`/api/contacts?role=${role}`);
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const result = await res.json();
      if (result.success) {
        setDbContacts(result.contacts);
        // Select all by default
        const initialSelected: Record<string | number, boolean> = {};
        result.contacts.forEach((c: any) => {
          initialSelected[c.id] = true;
        });
        setSelectedContacts(initialSelected);
      } else {
        toast.error("Failed to load contacts: " + result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error loading contacts from database.");
    }
  };

  // Fetch past broadcast logs
  const fetchBroadcastLogs = async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await fetch("/api/broadcast/send");
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const result = await res.json();
      if (result.success) {
        setBroadcastLogs(result.logs);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  // Bulk import spreadsheet contacts to DB
  const importExcelToDb = async () => {
    if (data.length === 0) {
      return toast.error("Please upload an Excel sheet in Tab 1 first.");
    }

    const toastId = toast.loading(`Importing ${data.length} records into Database as ${importRole.toUpperCase()}...`);
    try {
      // Auto-detect columns (case-insensitive)
      const nameKey = Object.keys(data[0]).find(k => k.toLowerCase().includes('name')) || 'name';
      const emailKey = Object.keys(data[0]).find(k => k.toLowerCase().includes('email')) || 'email';
      const phoneKey = Object.keys(data[0]).find(k => /phone|mobile|whatsapp|contact/i.test(k)) || 'phone';

      const formattedContacts = data.map(row => ({
        name: row[nameKey] || row.name || "Unknown",
        email: row[emailKey] || row.email || "",
        phone: row[phoneKey] || row.phone || row.mobile || "",
        role: importRole
      })).filter(c => c.phone || c.email);

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: formattedContacts }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(`Successfully imported ${result.count} contacts to ${importRole}!`, { id: toastId });
        if (selectedRoleGroup === importRole) {
          fetchContacts(importRole);
        }
      } else {
        toast.error(`Import failed: ${result.error || "Unknown error"}`, { id: toastId });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`An error occurred during import: ${error.message}`, { id: toastId });
    }
  };

  // Delete single contact by ID
  const deleteContact = async (id: number) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success("Contact deleted successfully.");
        fetchContacts(selectedRoleGroup);
      } else {
        toast.error("Failed to delete contact: " + result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting contact.");
    }
  };

  // Clear all contacts by role
  const clearContactsByRole = async (role: string) => {
    if (!confirm(`Are you absolutely sure you want to delete ALL database contacts under the role '${role}'?`)) return;
    try {
      const res = await fetch(`/api/contacts?role=${role}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        toast.success(`Cleared all ${role} contacts successfully.`);
        fetchContacts(role);
      } else {
        toast.error("Failed to clear contacts: " + result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error clearing contacts.");
    }
  };

  // Trigger simultaneous broadcast
  const handleSaveLocalTemplate = async () => {
    if (!newTemplateName) {
      toast.error("Template name is required.");
      return;
    }
    const varMatches = newTemplateBody.match(/\\{\\{\\d+\\}\\}/g) || [];
    const variableCount = varMatches.length;
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          language: newTemplateLang || "en_US",
          body: newTemplateBody,
          variableCount
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Template saved locally!");
        setShowAddTemplateForm(false);
        setNewTemplateName("");
        setNewTemplateBody("");
        fetchMetaTemplates();
      } else {
        toast.error("Failed to save: " + data.error);
      }
    } catch (err: any) {
      toast.error("Error saving template: " + err.message);
    }
  };

  const handleDeleteLocalTemplate = async (name: string) => {
    try {
      const res = await fetch(`/api/whatsapp/templates?name=${encodeURIComponent(name)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Template deleted!");
        if (selectedTemplate?.name === name) {
          setSelectedTemplate(null);
        }
        fetchMetaTemplates();
      } else {
        toast.error("Failed to delete: " + data.error);
      }
    } catch (err: any) {
      toast.error("Error deleting template: " + err.message);
    }
  };

  const fetchMetaTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const res = await fetch("/api/whatsapp/templates");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.success) {
        setMetaTemplates(data.templates || []);
      } else {
        toast.error("Could not load templates: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      toast.error("Failed to fetch Meta templates. Check WHATSAPP_BUSINESS_ID in .env.local");
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const pollBroadcastStatus = (broadcastId: string) => {
    setActiveBroadcastId(broadcastId);
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/broadcast/status?id=" + broadcastId);
        const data = await res.json();
        if (data.success) {
          setBroadcastJobStats(data);
          if (Number(data.pending) === 0) {
            clearInterval(interval);
            setIsBroadcasting(false);
            toast.success(`Broadcast complete! Sent: ${data.sent}, Failed: ${data.failed}`);
          }
        }
      } catch {}
    }, 3000);
  };

  const handleBroadcastSend = async () => {
    let recipientsList = [];
    if (selectedRoleGroup === "Faculty" || selectedRoleGroup === "Student" || selectedRoleGroup === "Alumni") {
      recipientsList = dbContacts.filter(c => selectedContacts[c.id]);
    } else if (selectedRoleGroup === "Spreadsheet") {
      recipientsList = data.filter((_, idx) => selectedContacts[idx]);
    } else if (selectedRoleGroup === "Custom") {
      if (!customContact.phone) return toast.error("Please fill in the custom recipient phone number.");
      recipientsList = [{ ...customContact, email: "" }];
    }
    if (recipientsList.length === 0) return toast.error("Please select at least one recipient.");

    if (useTemplate) {
      // Template mode: use the job queue
      if (!selectedTemplate) return toast.error("Please select a Meta Template first.");
      setIsBroadcasting(true);
      setBroadcastJobStats(null);
      const toastId = toast.loading(`Queuing ${recipientsList.length} messages...`);
      try {
        const res = await fetch("/api/broadcast/queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: recipientsList,
            templateName: selectedTemplate.name,
            templateLang: selectedTemplate.language || "en_US",
            templateVarFields: templateVarValues,
            role: selectedRoleGroup === "Custom" || selectedRoleGroup === "Spreadsheet" ? "Custom" : selectedRoleGroup,
          }),
        });
        const result = await res.json();
        if (result.success) {
          toast.success(`Queued ${result.queued} messages! Broadcasting in background...`, { id: toastId });
          pollBroadcastStatus(result.broadcastId);
        } else {
          toast.error("Queue failed: " + result.error, { id: toastId });
          setIsBroadcasting(false);
        }

      } catch (err: unknown) {
        toast.error("Error: " + (err instanceof Error ? err.message : String(err)), { id: toastId });
      }
    } else {
      // Free-form text mode (existing flow, small lists only)
      const finalSendEmail = dashboardTab === "directory" ? false : sendEmail;
      if (finalSendEmail && (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass))
        return toast.error("Please configure SMTP settings in Tab 1.");
      setIsBroadcasting(true);
      setBroadcastProgress({ sent: 0, total: recipientsList.length });
      const toastId = toast.loading(`Broadcasting (0/${recipientsList.length})...`);
      try {
        const response = await fetch("/api/broadcast/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: recipientsList,
            messageText: broadcastMessage,
            sendWhatsApp: dashboardTab === "directory" ? true : sendWhatsApp,
            sendEmail: dashboardTab === "directory" ? false : sendEmail,
            smtpConfig,
            emailSubject: broadcastSubject,
            role: selectedRoleGroup === "Custom" || selectedRoleGroup === "Spreadsheet" ? "Custom" : selectedRoleGroup,
          }),
        });
        if (!response.ok) {
          let errMsg = `Server returned status ${response.status}`;
          try { const e = await response.json(); if (e.error) errMsg = e.error; } catch {}
          throw new Error(errMsg);
        }
        const result = await response.json();
        if (result.success) {
          toast.success(`Broadcast complete! Sent to ${recipientsList.length} recipients.`, { id: toastId });
          setBroadcastResults(result.results);
          fetchBroadcastLogs();
        } else {
          toast.error(`Broadcast failed: ${result.error || "Unknown"}`, { id: toastId });
        }

      } catch (error: unknown) {
        toast.error(`Broadcast failed: ${error instanceof Error ? error.message : String(error)}`, { id: toastId });
        setIsBroadcasting(false);
        setBroadcastProgress({ sent: recipientsList.length, total: recipientsList.length });
      }
    }
  };

  // Toggle Selection handlers
  const toggleSelectContact = (id: string | number, checked: boolean) => {
    setSelectedContacts((prev) => ({
      ...prev,
      [id]: checked,
    }));
  };

  const toggleSelectAllContacts = (checked: boolean) => {
    const updated = { ...selectedContacts };
    if (selectedRoleGroup === "Faculty" || selectedRoleGroup === "Student" || selectedRoleGroup === "Alumni") {
      dbContacts.forEach((c) => {
        updated[c.id] = checked;
      });
    } else if (selectedRoleGroup === "Spreadsheet") {
      data.forEach((_, idx) => {
        updated[idx] = checked;
      });
    }
    setSelectedContacts(updated);
  };

  // Load directory contacts and logs when tab/role changes
  useEffect(() => {
    if (dashboardTab === "directory") {
      fetchBroadcastLogs();
      if (selectedRoleGroup === "Faculty" || selectedRoleGroup === "Student" || selectedRoleGroup === "Alumni") {
        fetchContacts(selectedRoleGroup);
      }
    }
  }, [dashboardTab, selectedRoleGroup]);

  // Auto-load settings on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("jecrc_theme") as "dark" | "light";
    const savedConfig = localStorage.getItem("jecrc_smtpConfig");
    const savedTemplate = localStorage.getItem("jecrc_emailTemplate");

    if (savedTheme) setTheme(savedTheme);
    if (savedConfig) setSmtpConfig(JSON.parse(savedConfig));
    if (savedTemplate) setEmailTemplate(JSON.parse(savedTemplate));
  }, []);

  // Save theme on change
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("jecrc_theme", nextTheme);
    toast.success(`Switched to ${nextTheme.toUpperCase()} mode`);
  };

  // Auto-save settings when they change
  useEffect(() => {
    if (smtpConfig.host || smtpConfig.user) {
      localStorage.setItem("jecrc_smtpConfig", JSON.stringify(smtpConfig));
    }
  }, [smtpConfig]);

  useEffect(() => {
    localStorage.setItem("jecrc_emailTemplate", JSON.stringify(emailTemplate));
  }, [emailTemplate]);

  // Apply SMTP Presets
  const applyPreset = (preset: "jecrc_google" | "gmail" | "outlook" | "custom") => {
    const presets = {
      jecrc_google: { host: "smtp.gmail.com", port: 465 },
      gmail: { host: "smtp.gmail.com", port: 465 },
      outlook: { host: "smtp.office365.com", port: 587 },
      custom: { host: "", port: 465 },
    };
    setSmtpConfig((prev) => ({ ...prev, ...presets[preset] }));
    toast.success(`Applied ${preset.replace('_', ' ').toUpperCase()} preset (Port ${presets[preset].port})`);
  };

  // University Templates Presets
  const loadUniversityTemplate = (type: "credentials" | "exam" | "fees") => {
    if (type === "credentials") {
      setEmailTemplate({
        subject: "JECRC University - Academic Portal Access Credentials for {{name}}",
        body: "Dear {{name}},\n\nGreetings from JECRC University Administration.\n\nYour official student registration and portal access credentials for the academic session are detailed below:\n\nâ€¢ Student Name: {{name}}\nâ€¢ Roll Number: {{rollNumber}}\nâ€¢ Student ID: {{id}}\nâ€¢ Portal Login Email: {{email}}\nâ€¢ Temporary Password: {{password}}\n\nPlease log in to the official JECRC Student Portal to complete your registration.\n\nWarm regards,\nOffice of Academic Affairs\nJECRC University, Jaipur",
      });
    } else if (type === "exam") {
      setEmailTemplate({
        subject: "JECRC University - End Semester Examination Notice | {{name}}",
        body: "Dear {{name}},\n\nThis is an official communication regarding your upcoming End Semester Examinations at JECRC University.\n\nCandidate Profile:\nâ€¢ Name: {{name}}\nâ€¢ Roll Number: {{rollNumber}}\nâ€¢ Registered Email: {{email}}\n\nPlease ensure you carry your official University Identity Card and Hall Ticket to the examination center.\n\nBest of luck,\nController of Examinations\nJECRC University, Jaipur",
      });
    } else if (type === "fees") {
      setEmailTemplate({
        subject: "JECRC University - Academic Fee Receipt & Clearance Notice",
        body: "Dear {{name}},\n\nWe hereby confirm the receipt of your academic fee submission for student ID: {{id}}.\n\nRegistration Details:\nâ€¢ Name: {{name}}\nâ€¢ Roll Number: {{rollNumber}}\nâ€¢ Status: Fee Cleared\n\nThank you for your prompt clearance.\n\nFinance & Accounts Department\nJECRC University, Jaipur",
      });
    }
    toast.success("Loaded JECRC Official Template!");
  };

  // Insert Variable Tag into focused input
  const insertVariable = (varName: string) => {
    const tag = `{{${varName}}}`;
    if (focusedField === "subject") {
      setEmailTemplate((prev) => ({ ...prev, subject: prev.subject + " " + tag }));
    } else {
      setEmailTemplate((prev) => ({ ...prev, body: prev.body + " " + tag }));
    }
    toast.success(`Inserted ${tag}`);
  };

  // Calculate live preview
  let previewSubject = emailTemplate.subject;
  let previewBody = emailTemplate.body;

  if (data.length > 0) {
    const firstStudent = data[0];
    Object.keys(firstStudent).forEach((key) => {
      const value = String(firstStudent[key] || "");
      const regex = new RegExp(`{{${key}}}`, "gi");
      previewSubject = previewSubject.replace(regex, value);
      previewBody = previewBody.replace(regex, value);
    });
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];

        if (jsonData.length > 0) {
          setData(jsonData);
          setColumns(Object.keys(jsonData[0]));
          setCurrentStep(2);
          toast.success(`Loaded ${jsonData.length} student records successfully!`);
          setSendResults([]);
        } else {
          toast.error("The Excel sheet is empty.");
        }
      } catch (error) {
        console.error(error);
        toast.error("Error reading the Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSendEmails = async () => {
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.from) {
      setCurrentStep(2);
      return toast.error("Please fill in all required SMTP configuration fields.");
    }
    if (data.length === 0) {
      setCurrentStep(1);
      return toast.error("Please upload an Excel file with student data first.");
    }

    setIsSending(true);
    setSendResults([]);
    setProgress({ sent: 0, total: data.length });
    setStartTime(Date.now());

    const toastId = toast.loading(`Dispatching official emails via SSL Port ${smtpConfig.port} (0/${data.length})...`);
    let accumulatedResults: any[] = [];
    const BATCH_SIZE = 10;

    try {
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);

        const response = await fetch("/api/send-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: batch,
            smtpConfig,
            emailTemplate,
            useHtml: false,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          accumulatedResults = [...accumulatedResults, ...result.results];
        } else {
          toast.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.error || "Failed to send"}`, { id: toastId });
          break;
        }

        setSendResults(accumulatedResults);
        const newSentCount = Math.min(i + BATCH_SIZE, data.length);
        setProgress({ sent: newSentCount, total: data.length });
        toast.loading(`Dispatching official emails (${newSentCount}/${data.length})...`, { id: toastId });
      }

      toast.success(`Dispatch completed successfully!`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred during dispatch.", { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const downloadReport = () => {
    if (sendResults.length === 0) return;

    const reportData = data.map((row) => {
      const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes("email"));
      const rowEmail = emailKey ? row[emailKey] : null;
      const result = sendResults.find((r) => r.email === rowEmail);

      return {
        ...row,
        "Dispatch Status": result ? (result.success ? "Success" : "Failed") : "Not Sent",
        "Error Log": result?.error || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "JECRC_Dispatch_Report");
    XLSX.writeFile(wb, `JECRC_Email_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Stats & Calculations
  const successCount = sendResults.filter((r) => r.success).length;
  const failureCount = sendResults.filter((r) => !r.success).length;
  const inQueueCount = Math.max(0, data.length - progress.sent);
  const successRate = sendResults.length > 0 ? Math.round((successCount / sendResults.length) * 100) : 0;

  // ETA & Speed Calculation
  const elapsedTime = startTime && isSending ? Math.max(1, (Date.now() - startTime) / 1000) : 0;
  const sendSpeed = elapsedTime > 0 ? (progress.sent / elapsedTime).toFixed(1) : "0";
  const estimatedTimeRemaining = isSending && Number(sendSpeed) > 0
    ? Math.ceil(inQueueCount / Number(sendSpeed))
    : 0;

  // Filtered Table
  const filteredData = data.filter((row) => {
    const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes("email"));
    const rowEmail = emailKey ? String(row[emailKey] || "") : "";
    const nameVal = row.name ? String(row.name) : "";

    const matchesSearch = rowEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameVal.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "success") {
      const res = sendResults.find((r) => r.email === rowEmail);
      return res?.success === true;
    }
    if (activeTab === "failed") {
      const res = sendResults.find((r) => r.email === rowEmail);
      return res?.success === false;
    }
    return true;
  });

  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen relative overflow-hidden transition-colors duration-300 font-sans selection:bg-blue-600 selection:text-white ${isDark ? "bg-black text-slate-100" : "bg-[#f8fafc] text-slate-800"
      }`}>

      {/* Background Ambient Glow Orbs */}
      <div className={`absolute top-0 left-1/4 w-[32rem] h-[32rem] rounded-full blur-3xl pointer-events-none animate-glow-pulse ${isDark ? "bg-blue-600/10" : "bg-blue-500/5"}`}></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">

        {/* JECRC University Top Navigation Header */}
        <header className={`flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 rounded-3xl transition-all ${isDark ? "dark-glass border border-slate-800/80 shadow-2xl" : "light-glass border border-slate-200"
          }`}>
          <div className="flex items-center space-x-5">
            {/* Logo Container */}
            <div className={`p-2.5 rounded-2xl flex items-center justify-center transition-all ${isDark
                ? "bg-slate-900/90 border border-slate-800 shadow-xl"
                : "bg-white border border-slate-200 shadow-sm"
              }`}>
              <img
                src="/jecrc-logo.png"
                alt="JECRC University Logo"
                className={`h-12 sm:h-14 w-auto object-contain transition-all ${isDark ? "brightness-110 contrast-125" : "logo-blend-multiply"
                  }`}
              />
            </div>

            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-red-600 dark:text-red-500">
                  JECRC UNIVERSITY
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isDark ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}>
                  Official Dispatcher
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-1 flex items-center gap-2 font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Building2 className="w-3.5 h-3.5 text-blue-500" /> Office of Academic Affairs & Administration Portal
              </p>
            </div>
          </div>

          {/* Quick Metrics, Guide & Theme Switcher */}
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-2 md:pb-0">

            {/* Guide Button */}
            <button
              onClick={() => setShowGuideModal(true)}
              className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Guide</span>
            </button>

            {/* Light / Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-2xl border transition-all flex items-center justify-center shadow-sm active:scale-95 cursor-pointer ${isDark
                  ? "bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
            >
              {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5 text-slate-700" />}
            </button>

            <div className={`px-4 py-2 rounded-2xl border flex items-center space-x-3 min-w-[130px] ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
              <Users className="w-4 h-4 text-blue-500" />
              <div>
                <div className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-slate-400" : "text-slate-400"}`}>Total Students</div>
                <div className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-800"}`}>{data.length}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Selection Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 pb-1 overflow-x-auto">
          <button
            onClick={() => setDashboardTab("campaign")}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
              dashboardTab === "campaign"
                ? "border-blue-600 text-blue-600 dark:text-blue-500 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Email Campaigns</span>
          </button>
          <button
            onClick={() => setDashboardTab("directory")}
            className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center space-x-2 whitespace-nowrap ${
              dashboardTab === "directory"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-500 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Directory & Utility Broadcast</span>
          </button>
        </div>

        {dashboardTab === "campaign" ? (
          <>
            {/* Live Queue Dispatch Monitor Banner */}
            <div className={`p-6 rounded-3xl border transition-all ${isDark ? "dark-glass border-slate-800/80 shadow-2xl" : "light-glass border-slate-200"
              }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

            {/* Live Queue Counter Pill Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/80 border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total Contacts</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className={`text-lg font-bold mt-1 ${isDark ? "text-slate-100" : "text-slate-800"}`}>{data.length}</div>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/80 border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-amber-400" : "text-amber-600"}`}>In Queue</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className={`text-lg font-bold mt-1 ${isDark ? "text-amber-400" : "text-amber-600"}`}>{inQueueCount}</div>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/80 border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Dispatched</span>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className={`text-lg font-bold mt-1 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{successCount}</div>
              </div>

              <div className={`p-3.5 rounded-2xl border ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/80 border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${isDark ? "text-red-400" : "text-red-600"}`}>Failed</span>
                  <XCircle className="w-4 h-4 text-red-500" />
                </div>
                <div className={`text-lg font-bold mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>{failureCount}</div>
              </div>
            </div>

            {/* Live Queue Real-Time Speed & ETA Indicator */}
            {isSending && (
              <div className={`flex items-center gap-4 border p-4 rounded-2xl ${isDark ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-50 border-blue-200"
                }`}>
                <div className="p-2.5 rounded-xl bg-blue-600 text-white animate-spin">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span>Active SSL Queue Dispatch</span>
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  </div>
                  <div className={`text-[11px] mt-0.5 font-mono ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Speed: <strong className="font-semibold">{sendSpeed} emails/sec</strong> | ETA: <strong className="font-semibold">{estimatedTimeRemaining}s remaining</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {progress.total > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className={`font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Queue Progress: {progress.sent} / {progress.total} emails
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((progress.sent / progress.total) * 100)}%
                </span>
              </div>
              <div className={`w-full h-2.5 rounded-full overflow-hidden p-0.5 border ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-200 border-slate-300"
                }`}>
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${(progress.sent / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Workflow Interactive Stepper Bar */}
        <div className={`p-3.5 rounded-2xl border transition-all ${isDark ? "dark-glass border-slate-800/80 shadow-xl" : "light-glass border-slate-200"
          }`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { num: 1, title: "1. Data Upload", desc: "Excel / CSV File" },
              { num: 2, title: "2. SSL SMTP (465)", desc: "Port 465 Security" },
              { num: 3, title: "3. Template & Tags", desc: "Compose Notice" },
              { num: 4, title: "4. Verification", desc: "Preview & Dispatch" },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isDone = currentStep > step.num;

              return (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex items-center space-x-3 p-3 rounded-xl transition-all text-left border cursor-pointer ${isActive
                      ? isDark
                        ? "bg-gradient-to-r from-blue-500/20 via-indigo-500/10 to-transparent border-blue-500/50 text-white shadow-sm"
                        : "bg-blue-50 border-blue-200 text-blue-900 font-semibold"
                      : isDone
                        ? isDark ? "bg-slate-900/80 border-slate-800 text-slate-300" : "bg-emerald-50/60 border-emerald-200 text-emerald-800 font-medium"
                        : isDark ? "bg-slate-900/40 border-slate-900 text-slate-500" : "bg-slate-50 border-slate-200 text-slate-500 font-normal"
                    }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : isDone
                          ? "bg-emerald-600 text-white"
                          : isDark ? "bg-slate-800 text-slate-500" : "bg-slate-200 text-slate-600"
                      }`}
                  >
                    {isDone ? <Check className="w-4 h-4 font-bold" /> : step.num}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold truncate">{step.title}</div>
                    <div className={`text-[10px] font-normal truncate ${isDark ? "text-slate-400" : "text-slate-400"}`}>{step.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Data Source & SMTP Config (5 Columns) */}
          <div className="lg:col-span-5 space-y-8">

            {/* Step 1: Upload Excel */}
            <section className={`p-6 rounded-3xl border transition-all ${isDark ? "dark-glass border-slate-800/80" : "light-glass border-slate-200"
              }`}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                    01
                  </div>
                  <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                    <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Upload Student Master Sheet
                  </h2>
                </div>
                {data.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {data.length} Loaded
                  </span>
                )}
              </div>

              <div
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer group relative ${isDark ? "border-slate-800 hover:border-blue-500/80 hover:bg-blue-500/5" : "border-slate-300 hover:border-blue-500 hover:bg-blue-50/40"
                  }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`p-4 rounded-2xl transition-all duration-300 mb-3 border ${isDark ? "bg-slate-900 text-slate-400 border-slate-800 group-hover:text-blue-400" : "bg-slate-100 text-slate-500 border-slate-200 group-hover:text-blue-600"
                  }`}>
                  <Upload className="w-7 h-7" />
                </div>
                <p className={`text-sm font-semibold transition-colors ${isDark ? "text-slate-200 group-hover:text-blue-400" : "text-slate-800 group-hover:text-blue-600"}`}>
                  Upload Student Excel / CSV File
                </p>
                <p className={`text-xs mt-1 font-normal ${isDark ? "text-slate-400" : "text-slate-400"}`}>
                  Supports columns: Name, Email, Roll Number, ID, Password
                </p>

                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
              </div>

              {data.length > 0 && (
                <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between text-xs ${isDark ? "bg-slate-900/80 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700 font-medium"
                  }`}>
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-mono">{data.length} records ready for university dispatch</span>
                  </div>
                  <button
                    onClick={() => {
                      setData([]);
                      setSendResults([]);
                      setColumns([]);
                    }}
                    className="text-red-500 font-semibold hover:underline text-[11px] cursor-pointer"
                  >
                    Clear File
                  </button>
                </div>
              )}

              {/* Next Step Control */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 text-white font-medium text-xs flex items-center space-x-2 hover:opacity-90 transition-all cursor-pointer"
                >
                  <span>Continue to SMTP Setup</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* Step 2: SMTP Configuration */}
            <section className={`p-6 rounded-3xl border transition-all ${isDark ? "dark-glass border-slate-800/80" : "light-glass border-slate-200"
              } space-y-5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                    02
                  </div>
                  <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                    <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    University SMTP Auth
                  </h2>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Port 465 SSL
                </span>
              </div>

              {/* Server Presets */}
              <div>
                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Mail Server Presets (Port 465 SSL)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "jecrc_google", name: "JECRC Workspace" },
                    { id: "gmail", name: "Standard Gmail" },
                    { id: "outlook", name: "Outlook / 365" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p.id as any)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all text-center truncate cursor-pointer ${isDark
                          ? "bg-slate-900 border-slate-800 text-slate-300 hover:bg-blue-500/20 hover:text-blue-300"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <User className="w-3.5 h-3.5 text-slate-400" /> Sender Email (Official From Address)
                  </label>
                  <input
                    type="email"
                    value={smtpConfig.from}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, from: e.target.value })}
                    placeholder="admin@jecrcu.edu.in"
                    className={`w-full px-3.5 py-2.5 rounded-xl outline-none text-xs transition-all font-normal ${isDark ? "dark-input" : "light-input"
                      }`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      <Server className="w-3.5 h-3.5 text-slate-400" /> SMTP Host
                    </label>
                    <input
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className={`w-full px-3.5 py-2.5 rounded-xl outline-none text-xs transition-all font-normal ${isDark ? "dark-input" : "light-input"
                        }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>Port (SSL)</label>
                    <input
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                      placeholder="465"
                      className={`w-full px-3.5 py-2.5 rounded-xl outline-none text-xs transition-all font-bold ${isDark ? "dark-input text-amber-400" : "light-input text-blue-600"
                        }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <User className="w-3.5 h-3.5 text-slate-400" /> Server Username
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.user}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                    placeholder="admin@jecrcu.edu.in"
                    className={`w-full px-3.5 py-2.5 rounded-xl outline-none text-xs transition-all font-normal ${isDark ? "dark-input" : "light-input"
                      }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <Key className="w-3.5 h-3.5 text-slate-400" /> Password / Google App Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={smtpConfig.pass}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                      placeholder="Enter App Password"
                      className={`w-full px-3.5 py-2.5 pr-10 rounded-xl outline-none text-xs transition-all font-normal ${isDark ? "dark-input" : "light-input"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Next Step Control */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setCurrentStep(3)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 text-white font-medium text-xs flex items-center space-x-2 hover:opacity-90 transition-all cursor-pointer"
                >
                  <span>Continue to Notice Composer</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>

          </div>

          {/* Right Column: Campaign Composer & Dispatch (7 Columns) */}
          <div className="lg:col-span-7 space-y-8">

            {/* Step 3: Campaign Composer */}
            <section className={`p-6 rounded-3xl border transition-all ${isDark ? "dark-glass border-slate-800/80" : "light-glass border-slate-200"
              } space-y-5`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                    03
                  </div>
                  <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                    <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    JECRC Notice Composer
                  </h2>
                </div>

                {/* University Quick Templates */}
                <div className="flex items-center space-x-1.5">
                  <span className={`text-[10px] font-semibold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>Presets:</span>
                  <button
                    onClick={() => loadUniversityTemplate("credentials")}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 text-[11px] font-medium transition-all cursor-pointer"
                  >
                    Credentials Notice
                  </button>
                  <button
                    onClick={() => loadUniversityTemplate("exam")}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px] font-medium transition-all cursor-pointer"
                  >
                    Exam Notice
                  </button>
                </div>
              </div>

              {/* Variable Chips Bar */}
              {columns.length > 0 && (
                <div className={`p-3 rounded-2xl border space-y-2 ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Click Tag to Auto-Insert into Notice:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {columns.map((col) => (
                      <button
                        key={col}
                        onClick={() => insertVariable(col)}
                        className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-medium transition-all hover:scale-105 cursor-pointer ${isDark ? "bg-blue-500/15 border-blue-500/30 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-800"
                          }`}
                      >
                        +&#123;&#123;{col}&#125;&#125;
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>Official Subject Line</label>
                  <input
                    ref={subjectInputRef}
                    onFocus={() => setFocusedField("subject")}
                    type="text"
                    value={emailTemplate.subject}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, subject: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl outline-none font-medium text-sm transition-all ${isDark ? "dark-input" : "light-input"
                      }`}
                    placeholder="Enter official email subject line..."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className={`block text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Notice Body (Plain Text)</label>
                    <span className="text-[10px] text-slate-400 font-mono font-medium">
                      {emailTemplate.body.length} characters
                    </span>
                  </div>
                  <textarea
                    ref={bodyInputRef}
                    onFocus={() => setFocusedField("body")}
                    rows={9}
                    value={emailTemplate.body}
                    onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl outline-none font-mono text-xs font-normal leading-relaxed transition-all ${isDark ? "dark-input" : "light-input"
                      }`}
                    placeholder="Type official university notice..."
                  />
                </div>
              </div>

              {/* Next Step Control */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 text-white font-medium text-xs flex items-center space-x-2 hover:opacity-90 transition-all cursor-pointer"
                >
                  <span>Proceed to Live Preview & Dispatch</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </section>

            {/* Step 4: Verification & Dispatch Control */}
            <section className={`p-6 rounded-3xl border transition-all ${isDark ? "dark-glass border-slate-800/80" : "light-glass border-slate-200"
              } space-y-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-semibold text-xs">
                    04
                  </div>
                  <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                    <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Preview & Dispatch Execution
                  </h2>
                </div>

                <button
                  onClick={handleSendEmails}
                  disabled={isSending || data.length === 0}
                  className={`flex items-center space-x-2.5 px-6 py-2.5 rounded-xl font-medium text-xs text-white transition-all shadow-sm ${isSending || data.length === 0
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-200"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:scale-[1.01] active:scale-95 cursor-pointer"
                    }`}
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Dispatching ({progress.sent}/{progress.total})</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Dispatch to {data.length} Students</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample Live Output Preview */}
              {data.length > 0 ? (
                <div className={`border rounded-2xl p-5 space-y-4 ${isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200 shadow-sm text-slate-800"
                  }`}>
                  <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-xl border ${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}`}>
                        <img
                          src="/jecrc-logo.png"
                          alt="JECRC"
                          className={`h-6 w-auto object-contain ${isDark ? "" : "logo-blend-multiply"}`}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                        Sample Verification Notice (Student Row 1)
                      </span>
                    </div>
                    <span className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> SSL Port 465
                    </span>
                  </div>

                  <div>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>Subject:</div>
                    <div className={`text-sm font-bold mt-0.5 ${isDark ? "text-slate-100" : "text-slate-900"}`}>{previewSubject}</div>
                  </div>

                  <div>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Notice Body:</div>
                    <div className={`text-xs font-mono p-4 rounded-xl border whitespace-pre-wrap leading-relaxed font-normal ${isDark ? "bg-slate-950/90 text-slate-200 border-slate-800" : "bg-slate-50 text-slate-800 border-slate-200"
                      }`}>
                      {previewBody}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                  <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-normal">Upload Student Excel Sheet to generate live verification preview.</p>
                </div>
              )}

              {/* Data & Dispatch Results Log Table */}
              {data.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Status Filter Tabs */}
                    <div className={`flex items-center space-x-1 p-1 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
                      }`}>
                      <button
                        onClick={() => setActiveTab("all")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === "all" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                      >
                        All ({data.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("success")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === "success" ? "bg-emerald-600 text-white shadow-sm font-semibold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                      >
                        Success ({successCount})
                      </button>
                      <button
                        onClick={() => setActiveTab("failed")}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === "failed" ? "bg-red-600 text-white shadow-sm font-semibold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                      >
                        Failed ({failureCount})
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student / email..."
                        className={`pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none w-full sm:w-52 font-normal ${isDark ? "dark-input" : "light-input"
                          }`}
                      />
                    </div>
                  </div>

                  {/* Student Records Table */}
                  <div className={`border rounded-2xl overflow-hidden ${isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"
                    }`}>
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs text-left">
                        <thead className={`border-b sticky top-0 uppercase tracking-wider text-[10px] font-semibold ${isDark ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                          <tr>
                            {sendResults.length > 0 && <th className="px-4 py-2.5">Status</th>}
                            {columns.map((col, i) => (
                              <th key={i} className="px-4 py-2.5 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono font-normal">
                          {filteredData.slice(0, 10).map((row, idx) => {
                            const emailKey = Object.keys(row).find((k) => k.toLowerCase().includes("email"));
                            const rowEmail = emailKey ? row[emailKey] : null;
                            const result = sendResults.find((r) => r.email === rowEmail);

                            return (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                {sendResults.length > 0 && (
                                  <td className="px-4 py-2">
                                    {result ? (
                                      result.success ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                                          <CheckCircle className="w-3 h-3" /> Dispatched
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 dark:bg-red-500/10 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-500/20">
                                          <XCircle className="w-3 h-3" /> Failed
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-400">Pending</span>
                                    )}
                                  </td>
                                )}
                                {columns.map((col, i) => (
                                  <td key={i} className={`px-4 py-3 truncate max-w-[140px] ${isDark ? "text-slate-300" : "text-slate-800 font-normal"}`}>
                                    {row[col] ? String(row[col]) : <span className="text-slate-400">-</span>}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {filteredData.length > 10 && (
                      <div className={`px-4 py-2 text-center text-[11px] border-t font-mono font-medium ${isDark ? "bg-slate-900/90 text-slate-500 border-slate-800" : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                        Showing 10 of {filteredData.length} student records.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

          </div>
        </div>
        </>
      ) : (
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
          {/* Header & Category Target Selector */}
          <div className={`p-6 rounded-3xl border transition-all ${
            isDark ? "dark-glass border-slate-800/80 shadow-2xl" : "light-glass border-slate-200"
          } space-y-6`}>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className={`text-base font-bold flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                  <Database className="w-5 h-5 text-emerald-500" />
                  JECRC Utility Broadcasting Service
                </h2>
                <p className={`text-xs mt-1 font-normal ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Send direct customized notifications via WhatsApp and Email to JECRC groups.
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span className="text-xs font-bold text-emerald-500">Service Online</span>
              </div>
            </div>

            {/* Target Audience Selectors */}
            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Select Target Audience Group
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "Faculty", label: "Faculty" },
                  { id: "Student", label: "Students" },
                  { id: "Alumni", label: "Alumni" },
                  { id: "Custom", label: "Custom Input" },
                ].map((item) => {
                  let finalCount = 0;
                  if (item.id === "Faculty" || item.id === "Student" || item.id === "Alumni") {
                    finalCount = dbContacts.filter(c => c.role === item.id).length;
                  } else {
                    finalCount = 1;
                  }

                  const isActive = selectedRoleGroup === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedRoleGroup(item.id as any);
                        setSelectedContacts({});
                      }}
                      className={`py-2.5 px-2 rounded-xl text-center border font-bold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        isActive
                          ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10"
                          : isDark
                          ? "bg-slate-955 border-slate-800 text-slate-300 hover:text-white"
                          : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      <span className="truncate w-full">{item.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {item.id === "Custom" ? "1" : finalCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Broadcast Progress Stats Banner */}
          {isBroadcasting && (
            <div className={`p-5 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl animate-spin">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">Broadcasting execution active...</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Progress: {broadcastProgress.sent} / {broadcastProgress.total} contacts
                  </div>
                </div>
              </div>
              <div className="mt-3 w-full h-1.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${(broadcastProgress.sent / broadcastProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Main Notice Dispatch & Recipient Settings */}
          <div className={`p-6 rounded-3xl border transition-all ${
            isDark ? "dark-glass border-slate-800/80 shadow-2xl" : "light-glass border-slate-200"
          } space-y-6`}>
            
            {/* Custom Input or Checklist (Masked) */}
            {selectedRoleGroup === "Custom" ? (
              <div className={`p-4 rounded-2xl border space-y-4 ${isDark ? "bg-slate-955/60 border-slate-850" : "bg-slate-50 border-slate-200"}`}>
                <h4 className="text-xs font-bold flex items-center gap-1.5 text-emerald-500">
                  <UserPlus className="w-4 h-4" /> Send Message to Specific Recipient
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={customContact.name}
                      onChange={(e) => setCustomContact({ ...customContact, name: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl outline-none text-xs ${isDark ? "dark-input" : "light-input"}`}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">WhatsApp Phone</label>
                    <input
                      type="text"
                      value={customContact.phone}
                      onChange={(e) => setCustomContact({ ...customContact, phone: e.target.value })}
                      className={`w-full px-3 py-2 rounded-xl outline-none text-xs ${isDark ? "dark-input text-emerald-400 font-bold" : "light-input font-bold"}`}
                      placeholder="919876543210"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="inline-flex items-center text-xs font-semibold text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dbContacts.length > 0 && dbContacts.every((c) => selectedContacts[c.id])}
                      onChange={(e) => toggleSelectAllContacts(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 mr-2 cursor-pointer h-4 w-4"
                    />
                    Select All Recipients ({dbContacts.length} in DB)
                  </label>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className={`pl-8 pr-3 py-1.5 rounded-xl text-xs outline-none w-full sm:w-48 ${
                        isDark ? "dark-input" : "light-input"
                      }`}
                    />
                  </div>
                </div>

                {/* Table Grid (Masked numbers) */}
                <div className={`border rounded-2xl overflow-hidden ${isDark ? "border-slate-800 bg-slate-955/20" : "border-slate-200 bg-white"}`}>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs text-left">
                      <thead className={`border-b sticky top-0 uppercase tracking-wider text-[9px] font-semibold ${
                        isDark ? "bg-slate-900 text-slate-400 border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}>
                        <tr>
                          <th className="px-4 py-2 w-10 text-center">Select</th>
                          <th className="px-4 py-2">Name</th>
                          <th className="px-4 py-2">Phone (Masked)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                        {dbContacts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-slate-500 font-semibold">
                              Directory is empty for group '${selectedRoleGroup}'. Contact admin to import.
                            </td>
                          </tr>
                        ) : (
                          dbContacts
                            .filter((c) => {
                              return (
                                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                c.email.toLowerCase().includes(searchQuery.toLowerCase())
                              );
                            })
                            .map((contact) => (
                              <tr key={contact.id} className="hover:bg-slate-900/40">
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!selectedContacts[contact.id]}
                                    onChange={(e) => toggleSelectContact(contact.id, e.target.checked)}
                                    className="rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-slate-300 font-semibold">{contact.name}</td>
                                <td className="px-4 py-2.5 text-slate-300">{maskPhoneNumber(contact.phone)}</td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Notice Composer - Template & Free-form */}
            <div className="space-y-4 pt-3 border-t border-slate-800">

              {/* Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center text-xs font-bold text-slate-300">
                  <Smartphone className="w-4 h-4 text-emerald-500 mr-1.5" />
                  WhatsApp Broadcast (Meta Cloud API)
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${!useTemplate ? "text-emerald-400" : "text-slate-500"}`}>Free Text</span>
                  <button
                    type="button"
                    onClick={() => setUseTemplate(v => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${useTemplate ? "bg-emerald-600" : "bg-slate-700"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${useTemplate ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className={`text-[10px] font-bold ${useTemplate ? "text-emerald-400" : "text-slate-500"}`}>Use Template</span>
                </div>
              </div>

              {useTemplate ? (
                /* ---- TEMPLATE MODE ---- */
                <div className="space-y-4">
                  {/* Load Templates Button + Search */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={templateSearch}
                        onChange={e => setTemplateSearch(e.target.value)}
                        placeholder="Search template name..."
                        className="pl-8 pr-3 py-2 rounded-xl text-xs outline-none w-full dark-input font-normal"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={fetchMetaTemplates}
                      disabled={isLoadingTemplates}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingTemplates ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync/Load
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddTemplateForm(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Template
                    </button>
                  </div>

                  {/* Create Local Template Form */}
                  {showAddTemplateForm && (
                    <div className={`p-4 rounded-xl border space-y-3 ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                      <div className="text-xs font-bold text-emerald-400">Create Local Template</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold mb-1">TEMPLATE NAME (Must match Meta name)</label>
                          <input
                            type="text"
                            value={newTemplateName}
                            onChange={e => setNewTemplateName(e.target.value)}
                            placeholder="e.g. fee_receipt_alert"
                            className="w-full px-3 py-2 rounded-xl text-xs outline-none dark-input"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold mb-1">LANGUAGE</label>
                          <input
                            type="text"
                            value={newTemplateLang}
                            onChange={e => setNewTemplateLang(e.target.value)}
                            placeholder="e.g. en_US"
                            className="w-full px-3 py-2 rounded-xl text-xs outline-none dark-input"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold mb-1">BODY CONTENT (Use {"{{1}}"}, {"{{2}}"} for variables)</label>
                        <textarea
                          rows={3}
                          value={newTemplateBody}
                          onChange={e => setNewTemplateBody(e.target.value)}
                          placeholder="e.g. Dear {{1}}, your fee receipt is generated. ID: {{2}}"
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none dark-input leading-relaxed font-mono"
                        />
                        <div className="text-[9px] text-slate-500 mt-1">
                          Use <code className="bg-slate-850 px-1 py-0.5 rounded text-blue-400">{"{{1}}"}</code>, <code className="bg-slate-850 px-1 py-0.5 rounded text-blue-400">{"{{2}}"}</code> etc. variables will auto-generate input fields.
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddTemplateForm(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveLocalTemplate}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          Save Template
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Template List */}
                  {metaTemplates.length > 0 && (
                    <div className="border border-slate-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                      {metaTemplates
                        .filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                        .map(t => (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => {
                              setSelectedTemplate(t);
                              setTemplateVarValues(Array(t.variableCount).fill(""));
                            }}
                            className={`w-full text-left px-4 py-3 text-xs flex items-start justify-between gap-4 transition-all cursor-pointer border-b border-slate-800 last:border-b-0 ${
                              selectedTemplate?.name === t.name
                                ? "bg-emerald-600/20 text-emerald-300"
                                : "hover:bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <div>
                              <div className="font-bold text-[11px]">{t.name}</div>
                              <div className="text-slate-500 text-[10px] mt-0.5 truncate max-w-xs">{t.body}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{t.language}</span>
                                {t.variableCount > 0 && (
                                  <span className="text-[9px] bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full">{t.variableCount} var{t.variableCount > 1 ? "s" : ""}</span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete local template "${t.name}"?`)) {
                                    handleDeleteLocalTemplate(t.name);
                                  }
                                }}
                                className="text-[8px] text-red-400 hover:text-red-300 hover:bg-red-950/20 px-1.5 py-0.5 rounded transition-all border border-transparent hover:border-red-900/40 cursor-pointer mt-1"
                              >
                                Delete
                              </button>
                            </div>
                          </button>
                        ))}
                    </div>
                  )}

                  {metaTemplates.length === 0 && !isLoadingTemplates && (
                    <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      Click "Sync/Load" or "Add Template" to manage your templates
                    </div>
                  )}

                  {/* Selected Template + Variable Inputs */}
                  {selectedTemplate && (
                    <div className={`p-4 rounded-xl border space-y-3 ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Selected Template</div>
                          <div className="text-sm font-bold text-emerald-400 mt-0.5">{selectedTemplate.name}</div>
                          <div className="text-[10px] text-slate-500 mt-1 font-mono">{selectedTemplate.body}</div>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      </div>

                      {/* Variable Inputs */}
                      {selectedTemplate.variableCount > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fill in Template Variables</div>
                          <div className="text-[10px] text-slate-500">Use <code className="bg-slate-800 px-1 rounded">{"{{name}}"}</code> to auto-fill recipient name, or type any fixed text.</div>
                          {Array.from({ length: selectedTemplate.variableCount }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-blue-400 w-8 shrink-0">{`{{${i + 1}}}`}</span>
                              <input
                                type="text"
                                value={templateVarValues[i] || ""}
                                onChange={e => {
                                  const updated = [...templateVarValues];
                                  updated[i] = e.target.value;
                                  setTemplateVarValues(updated);
                                }}
                                placeholder={i === 0 ? "{{name}} or fixed text" : "Enter value for variable " + (i + 1)}
                                className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none dark-input font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Progress Bar (shown while broadcasting) */}
                  {isBroadcasting && broadcastJobStats && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-300">Broadcasting in background...</span>
                        <span className="text-emerald-400">{broadcastJobStats.sent} / {broadcastJobStats.total} sent</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${broadcastJobStats.total > 0 ? Math.round((broadcastJobStats.sent / broadcastJobStats.total) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="flex gap-4 text-[10px]">
                        <span className="text-emerald-400">&#10003; {broadcastJobStats.sent} sent</span>
                        <span className="text-red-400">&#10007; {broadcastJobStats.failed} failed</span>
                        <span className="text-slate-400">&#8987; {broadcastJobStats.pending} pending</span>
                      </div>
                      <div className="text-[9px] text-slate-500 italic">You can safely close this browser. The broadcast will continue on the server.</div>
                    </div>
                  )}
                </div>
              ) : (
                /* ---- FREE TEXT MODE ---- */
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-300">Message Body (WhatsApp Text)</label>
                      <span className="text-[9px] text-slate-500 font-mono">{broadcastMessage.length} chars</span>
                    </div>
                    <textarea
                      rows={6}
                      value={broadcastMessage}
                      onChange={e => setBroadcastMessage(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl outline-none text-xs transition-all leading-relaxed font-mono ${isDark ? "dark-input" : "light-input"}`}
                      placeholder="Hello {{name}}, welcome back..."
                    />
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[9px] uppercase font-bold text-slate-500">Insert tag:</span>
                      {["name", "phone", "email"].map(tag => (
                        <button key={tag} type="button" onClick={() => setBroadcastMessage(prev => prev + ` {{${tag}}}`)}
                          className="px-2 py-0.5 border border-slate-800 text-[10px] font-mono rounded bg-slate-900 text-emerald-400 hover:text-emerald-350 transition-colors cursor-pointer">
                          +&#123;&#123;{tag}&#125;&#125;
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800 flex justify-center">
                    <div className="w-full max-w-md space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase text-center">WhatsApp Chat Preview</div>
                      <div className="bg-[#0b141a] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between min-h-[100px] relative overflow-hidden">
                        <div className="absolute inset-0 bg-[#0b141a]/95 pointer-events-none"></div>
                        <div className="relative z-10 bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-none px-3.5 py-2 text-xs max-w-[85%] self-end shadow-md font-sans">
                          <p className="whitespace-pre-wrap">
                            {(() => {
                              let sampleName = dbContacts.length > 0 ? dbContacts[0].name : "Recipient Name";
                              return broadcastMessage.replace(/{{name}}/gi, sampleName).replace(/{{phone}}/gi, "91****210").replace(/{{email}}/gi, "r***@jecrc.edu.in");
                            })()}
                          </p>
                          <div className="text-[9px] text-[#8696a0] text-right mt-1">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &#10003;&#10003;</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Dispatch Action */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleBroadcastSend}
                  disabled={isBroadcasting}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                    isBroadcasting
                      ? "bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-800"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10 cursor-pointer active:scale-95"
                  }`}
                >
                  {isBroadcasting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                      <span>Broadcasting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{useTemplate ? "Queue Broadcast via Template" : "Send WhatsApp Broadcast"}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
        </div>
        </div>
      )}
      </div>

      {/* Comprehensive In-Depth Documentation Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-2xl border relative overflow-hidden transition-all animate-modal-up ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900 shadow-2xl"
            }`}>

            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b pb-4 mb-6 ${isDark ? "border-slate-800" : "border-slate-200"
              }`}>
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-red-600 text-white rounded-2xl shadow-sm">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className={`text-lg sm:text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Simple Step-by-Step Guide
                  </h2>
                  <p className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    How to setup Excel, Google SMTP, and send emails easily
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Step Navigation */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[
                { step: 1, label: "1. Excel Sheet", icon: FileSpreadsheet },
                { step: 2, label: "2. Google Password", icon: Lock },
                { step: 3, label: "3. Email Template", icon: Tag },
                { step: 4, label: "4. Send & Report", icon: Layers },
              ].map((s) => {
                const IconComponent = s.icon;
                return (
                  <button
                    key={s.step}
                    onClick={() => setGuideStep(s.step)}
                    className={`py-3 px-2 rounded-2xl text-center font-bold text-xs transition-all border flex flex-col items-center gap-1.5 cursor-pointer ${guideStep === s.step
                        ? "bg-red-600 text-white border-red-500 shadow-sm scale-105"
                        : isDark
                          ? "bg-slate-800/50 border-slate-800 text-slate-300 hover:text-white"
                          : "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200"
                      }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span className="text-[11px] truncate w-full">{s.label}</span>
                  </button>
                );
              })}
            </div>

            {/* In-Depth Step Content */}
            <div className="min-h-[270px] space-y-4">

              {/* STEP 1 */}
              {guideStep === 1 && (
                <div className="space-y-4 animate-step-in">
                  <div className={`flex items-center space-x-2 font-bold text-sm ${isDark ? "text-red-400" : "text-red-700"}`}>
                    <FileSpreadsheet className="w-5 h-5" />
                    <h3>Step 1: Prepare Your Excel File</h3>
                  </div>

                  <div className={`p-4.5 rounded-2xl border text-xs space-y-3 font-medium ${isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}>
                    <p className={`leading-relaxed font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      Create a simple Excel sheet (`.xlsx`) or CSV file. The <strong>first row must contain column headers</strong> like this:
                    </p>

                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div className={`p-3 rounded-xl border font-bold ${isDark ? "bg-slate-900 border-slate-800 text-emerald-400" : "bg-white border-slate-300 text-slate-900 shadow-sm"
                        }`}>
                        name &nbsp;|&nbsp; email &nbsp;|&nbsp; rollNumber &nbsp;|&nbsp; id &nbsp;|&nbsp; password
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className={`font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Key Tips:</div>
                      <ul className={`space-y-1.5 list-disc pl-5 font-semibold ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                        <li>The system automatically detects the <strong>email column</strong>.</li>
                        <li>You can add any extra column (like <code>course</code> or <code>branch</code>) and use it in your email!</li>
                        <li>Then click <strong>Upload Student Master Sheet</strong> on the main dashboard.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {guideStep === 2 && (
                <div className="space-y-4 animate-step-in">
                  <div className={`flex items-center space-x-2 font-bold text-sm ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                    <Lock className="w-5 h-5" />
                    <h3>Step 2: Get Google App Password (Port 465 SSL)</h3>
                  </div>

                  <div className={`p-4.5 rounded-2xl border text-xs space-y-3 ${isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}>
                    <p className={`leading-relaxed font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      To send emails automatically, Google requires a 16-character App Password. Follow these easy steps:
                    </p>

                    <ol className={`space-y-3 list-decimal pl-5 font-semibold ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                      <li>
                        Enable <strong>2-Step Verification</strong> on your Google Account: &nbsp;
                        <a
                          href="https://myaccount.google.com/security"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/30"
                        >
                          Open Google Security <ArrowRight className="w-3 h-3" />
                        </a>
                      </li>

                      <li>
                        Open the <strong>App Passwords</strong> page directly: &nbsp;
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30"
                        >
                          Open App Passwords Page <ArrowRight className="w-3 h-3" />
                        </a>
                      </li>

                      <li>
                        Type a app name like <code>"JECRC Emailer"</code> and click <strong>Create</strong>.
                      </li>

                      <li>
                        Copy the 16-letter code shown on screen and paste it into the <strong>Password / Google App Password</strong> field in Step 02 on the dashboard.
                      </li>

                      <li>
                        Make sure SMTP Host is <code>smtp.gmail.com</code> and Port is <code>465</code> (SSL Secured).
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {guideStep === 3 && (
                <div className="space-y-4 animate-step-in">
                  <div className={`flex items-center space-x-2 font-bold text-sm ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                    <Tag className="w-5 h-5" />
                    <h3>Step 3: Compose Email & Use Dynamic Tags</h3>
                  </div>

                  <div className={`p-4.5 rounded-2xl border text-xs space-y-3 ${isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}>
                    <p className={`leading-relaxed font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      Write your email subject and body text. Use column names inside <code>&#123;&#123;double_braces&#125;&#125;</code> to auto-fill recipient data:
                    </p>

                    <div className={`p-3.5 rounded-xl font-mono text-[11px] space-y-1.5 border font-bold ${isDark ? "bg-slate-900 border-slate-800 text-amber-300" : "bg-white border-slate-300 text-slate-900 shadow-sm"
                      }`}>
                      <div>Subject: JECRC Credentials for &#123;&#123;name&#125;&#125;</div>
                      <div>Body: Dear &#123;&#123;name&#125;&#125;, your Roll Number is &#123;&#123;rollNumber&#125;&#125; and Password is &#123;&#123;password&#125;&#125;.</div>
                    </div>

                    <ul className={`space-y-2 list-disc pl-5 font-semibold ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                      <li>Click the tag pill buttons (e.g. <code>+&#123;&#123;name&#125;&#125;</code>) to instantly insert tags into your message body!</li>
                      <li>Or click <strong>Credentials Notice</strong> / <strong>Exam Notice</strong> presets for instant official templates.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {guideStep === 4 && (
                <div className="space-y-4 animate-step-in">
                  <div className={`flex items-center space-x-2 font-bold text-sm ${isDark ? "text-blue-400" : "text-blue-700"}`}>
                    <Layers className="w-5 h-5" />
                    <h3>Step 4: Dispatch Emails & Export Excel Report</h3>
                  </div>

                  <div className={`p-4.5 rounded-2xl border text-xs space-y-3 ${isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}>
                    <p className={`leading-relaxed font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                      Ready to send? Here is how dispatch works:
                    </p>

                    <ol className={`space-y-2.5 list-decimal pl-5 font-semibold ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                      <li>Check the <strong>Sample Verification Notice</strong> preview for Student Row 1 to make sure all variables look correct.</li>
                      <li>Click <strong>Dispatch to Students</strong> button to start sending.</li>
                      <li>Watch the live counters: Dispatched, In Queue, Failed, Speed (emails/sec), and ETA timer.</li>
                      <li>When finished, click <strong>Export Official Excel Report</strong> to download a full record sheet showing success or error status for every student.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Navigation Controls */}
            <div className={`flex items-center justify-between border-t pt-4 mt-6 ${isDark ? "border-slate-800" : "border-slate-200"
              }`}>
              <button
                onClick={() => setGuideStep((prev) => Math.max(1, prev - 1))}
                disabled={guideStep === 1}
                className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${guideStep === 1
                    ? isDark ? "border-slate-800 text-slate-600 bg-slate-900 cursor-not-allowed" : "border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed"
                    : isDark ? "border-slate-700 text-white hover:bg-slate-800" : "border-slate-300 text-slate-900 hover:bg-slate-100"
                  }`}
              >
                Previous Step
              </button>

              {guideStep < 4 ? (
                <button
                  onClick={() => setGuideStep((prev) => Math.min(4, prev + 1))}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-red-500/20 cursor-pointer"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Close Documentation Guide
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
