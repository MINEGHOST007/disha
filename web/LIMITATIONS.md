# Current integration limits

- Disha reads merchant-supplied supplier bills and transaction exports. The Paytm transaction endpoint is future work; no Paytm connector is used today.
- Digital collections are not the merchant's full cash position. Cash sales and non-imported expenses are invisible, so the cash-gap card is an estimate, not a balance or promise.
- Supplier purchase-cycle quantities do not equal sales velocity or on-hand stock. Disha requires at least two invoices containing an item before forecasting that item; products absent from the latest cycle are surfaced separately.
- Bill OCR can misread handwriting, units or decimal points. Every extraction remains an editable draft until the merchant confirms the invoice and arithmetic checks pass.
- Customer frequency is derived from successful recorded payment dates. It cannot establish why a customer has not paid. Auto-match requires an exact name or merchant-configured alias and applies only to transactions dated after the Khata entry was created.
- The supplier caller requires LiveKit credentials, an outbound SIP trunk and a working phone provider. The web app asks for explicit order approval before dialing. Seller changes remain in review until the merchant resolves them.
- OpenRouter and Sarvam availability, account model access, pricing and rate limits depend on each merchant's configured provider account.
- Synthetic data is limited to tests and evaluation fixtures; empty merchant workspaces are not preloaded.
