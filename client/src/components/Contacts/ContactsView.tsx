import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Search, Trash2, RefreshCw, Filter, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, AlertCircle,
  ShieldAlert, KeyRound, Lock
} from 'lucide-react';
import { Contact } from '../../types';
import { api } from '../../api';

interface ContactsViewProps {
  onContactsChange: () => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ onContactsChange }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [optedOutCount, setOptedOutCount] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear all passkey confirmation modal state
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // New contact form fields
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTag, setNewTag] = useState('General');
  const [addError, setAddError] = useState<string | null>(null);

  // Load available tags
  const loadTags = async () => {
    try {
      const tags = await api.getTags();
      setAvailableTags(tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  // Load contacts with search, tag, limit, offset
  const loadContacts = async () => {
    setIsLoading(true);
    try {
      const offset = (currentPage - 1) * pageSize;
      const data = await api.getContacts({
        search: search.trim() || undefined,
        tag: selectedTag !== 'ALL' ? selectedTag : undefined,
        limit: pageSize,
        offset,
      });

      setContacts(data.contacts);
      setTotal(data.total);
      setFilteredTotal(data.filteredTotal ?? data.total);
      setOptedOutCount(data.optedOutCount);
    } catch (err: any) {
      console.error('Error loading contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadContacts();
  }, [search, selectedTag, currentPage, pageSize]);

  // Reset to page 1 on filter changes
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleToggleOptOut = async (id: string) => {
    await api.toggleOptOut(id);
    loadContacts();
    onContactsChange();
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteContact(contactToDelete.id);
      setContactToDelete(null);
      // Adjust page if last item on page deleted
      if (contacts.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else {
        loadContacts();
      }
      loadTags();
      onContactsChange();
    } catch (err: any) {
      alert(err.message || 'Failed to delete contact');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    setAddError(null);

    try {
      await api.createContact({
        name: newName.trim(),
        phone_number: newPhone.trim(),
        tags: newTag.trim() || 'General',
        variables: {
          '1': newName.split(' ')[0],
          '2': 'GREEN25',
        },
      });

      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setNewTag('General');
      setAddError(null);
      loadTags();
      loadContacts();
      onContactsChange();
    } catch (err: any) {
      setAddError(err.message || 'Failed to save contact');
    }
  };

  const handleOpenClearAllModal = () => {
    setPasskeyInput('');
    setClearError(null);
    setShowClearAllModal(true);
  };

  const handleConfirmClearAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkeyInput.trim()) {
      setClearError('Please enter the security passkey.');
      return;
    }

    setIsClearingAll(true);
    setClearError(null);
    try {
      await api.clearAllContacts(passkeyInput.trim());
      setShowClearAllModal(false);
      setPasskeyInput('');
      loadTags();
      loadContacts();
      onContactsChange();
    } catch (err: any) {
      setClearError(err.message || 'Failed to clear contacts. Incorrect passkey?');
    } finally {
      setIsClearingAll(false);
    }
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const startItem = filteredTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(filteredTotal, currentPage * pageSize);

  // Smart page number buttons generator
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">Contacts & Audience</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {total} total contacts ({total - optedOutCount} active · {optedOutCount} unsubscribed)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by contact name or phone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tag Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Audience Tag:</span>
            <select
              value={selectedTag}
              onChange={(e) => handleTagChange(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
            >
              <option value="ALL">All Audiences ({total})</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            {total > 0 && (
              <button
                onClick={handleOpenClearAllModal}
                className="text-xs text-slate-500 hover:text-rose-400 ml-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Clear All Contacts (Requires Passkey)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Tag indicator if filtered */}
        {selectedTag !== 'ALL' && (
          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-400">
            <span>Filtered by audience tag: <strong>{selectedTag}</strong> ({filteredTotal} matching)</span>
            <button
              onClick={() => handleTagChange('ALL')}
              className="text-[11px] text-slate-400 hover:text-white underline ml-1"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Contacts Table */}
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-slate-500 text-[10px] uppercase border-b border-slate-800/80">
              <tr>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Phone Number</th>
                <th className="py-2.5 px-3">Audience Tag</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-400" />
                    <span>Loading contacts...</span>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No contacts match your filter.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => {
                  const isOptedOut = c.is_opted_out === 1;
                  return (
                    <tr key={c.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-white">{c.name}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{c.phone_number}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800/80 text-slate-300 text-[10px]">
                          {c.tags}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {isOptedOut ? (
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            Unsubscribed
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleToggleOptOut(c.id)}
                            className="text-[11px] text-slate-400 hover:text-white transition-colors"
                            title={isOptedOut ? 'Re-activate contact' : 'Unsubscribe contact'}
                          >
                            {isOptedOut ? 'Re-activate' : 'Unsubscribe'}
                          </button>

                          {/* Delete Particular Contact Button */}
                          <button
                            onClick={() => setContactToDelete(c)}
                            className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Proper Pagination Controls */}
        <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          {/* Item range count */}
          <div>
            Showing <strong className="text-white">{startItem}</strong> to <strong className="text-white">{endItem}</strong> of <strong className="text-white">{filteredTotal}</strong> contacts
          </div>

          {/* Page navigation buttons */}
          <div className="flex items-center gap-1.5">
            {/* First Page */}
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1 mx-1">
              {getPageNumbers().map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span key={idx} className="px-1.5 py-0.5 text-slate-500">
                      ...
                    </span>
                  );
                }
                const isActive = p === currentPage;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(p)}
                    className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Last Page */}
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Delete Contact Confirmation Modal */}
      {contactToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-2xl">
            <h3 className="font-semibold text-sm text-white">Delete Contact</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">{contactToDelete.name}</strong> (<span className="font-mono text-slate-400">{contactToDelete.phone_number}</span>)?
            </p>
            <p className="text-[11px] text-slate-500">
              This contact will be permanently removed from audience lists and future broadcasts.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContactToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteContact}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs shadow transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-white">Add New Contact</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="leading-tight">{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateContact} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Phone Number (with country code)</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +919876543210"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Audience Tag / Group</label>
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="e.g. Solar Prospect, VIP Client"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clear All Contacts with Passkey Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-white">Clear All Contacts & Data</h3>
                  <p className="text-xs text-slate-400">Security Passkey Authorization Required</p>
                </div>
              </div>
              <button 
                onClick={() => !isClearingAll && setShowClearAllModal(false)} 
                className="text-slate-500 hover:text-white"
                disabled={isClearingAll}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs leading-relaxed space-y-1">
              <p className="font-semibold flex items-center gap-1.5 text-rose-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Warning: Permanent Deletion
              </p>
              <p>
                This action will permanently delete all <strong>{total}</strong> contacts, active conversations, and message logs from your database.
              </p>
            </div>

            {clearError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{clearError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmClearAll} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  Enter Administrator Passkey
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passkeyInput}
                    onChange={(e) => setPasskeyInput(e.target.value)}
                    placeholder="Enter passkey (e.g. HelloIntelligreen)"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono tracking-wider"
                    autoFocus
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Default passkey: <code className="text-amber-400/90 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">HelloIntelligreen</code>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearAllModal(false)}
                  disabled={isClearingAll}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClearingAll || !passkeyInput.trim()}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg shadow-rose-900/30 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearingAll ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Deleting All Data...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Confirm & Delete All
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
