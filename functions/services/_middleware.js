/* =======================================================
   Services
   ======================================================= */

.es-form-grid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.es-check-grid {
  display: grid;
  gap: 10px;
  margin-top: 24px;
}

.es-check-option {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
}

.es-check-option input {
  width: auto;
  min-height: auto;
  margin: 0;
}

.es-fieldset {
  margin: 24px 0 0;
  padding: 18px;
  border: 1px solid var(--es-border);
  border-radius: var(--es-radius-md);
}

.es-fieldset legend {
  padding: 0 8px;
  font-size: 13px;
  font-weight: 700;
}

.es-provider-options {
  display: grid;
  gap: 12px;
}

.es-form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
}

.es-secondary-button {
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid var(--es-border);
  border-radius: var(--es-radius-sm);
  background: var(--es-surface);
  color: var(--es-text);
  font-weight: 700;
  cursor: pointer;
}

.es-secondary-button:hover {
  border-color: var(--es-primary);
}

.es-services-list {
  margin-top: 22px;
}

.es-service-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 0;
  border-bottom: 1px solid var(--es-border);
}

.es-service-main {
  display: grid;
  gap: 5px;
}

.es-service-main > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.es-service-main > span {
  color: var(--es-muted);
  font-size: 13px;
}

.es-service-badge {
  padding: 3px 8px;
  border-radius: 999px;
  background: #f1f3ef;
  color: var(--es-muted);
  font-size: 11px;
  font-weight: 700;
}

.es-muted-copy {
  margin: 0;
  color: var(--es-muted);
  font-size: 13px;
}

@media (max-width: 600px) {
  .es-form-grid {
    grid-template-columns: 1fr;
  }

  .es-service-row {
    align-items: stretch;
    flex-direction: column;
  }
}
