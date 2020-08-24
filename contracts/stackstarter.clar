;; Stackstarter version 1
;; By Marvin Janssen (2020)

;; contract version for testing
(define-constant contract-version u1)

;; contract owner
;; for testnet phase 3
;; (define-constant contract-owner tx-sender)

;; error constants
(define-constant error-general (err u1))
(define-constant error-not-owner (err u2))
(define-constant error-campaign-has-investors (err u3))
(define-constant error-campaign-does-not-exist (err u4))
(define-constant error-campaign-inactive (err u5))
(define-constant error-invest-amount-insufficient (err u6))
(define-constant error-invest-stx-transfer-failed (err u7))
(define-constant error-no-investment (err u8))
(define-constant error-campaign-already-funded (err u9))
(define-constant error-refund-stx-transfer-failed (err u10))
(define-constant error-target-not-reached (err u11))
(define-constant error-funding-stx-transfer-failed (err u12))
(define-constant error-already-funded (err u13))

;; current campaign ID nonce
(define-data-var campaign-id-nonce uint u0)

;; general information
(define-data-var total-campaigns-funded uint u0)
(define-data-var total-investments uint u0)
(define-data-var total-investment-value uint u0)

;; optional collection fee for contract-owner
;; (define-data-var contract-owner-collection-fee u0)

;; campaign information map
(define-map campaigns ((campaign-id uint))
	(
		(name (buff 64))			;; human-readable campaign name
		(fundraiser principal)		;; the address that is fundraising (could be a contract?)
		(goal uint)					;; funding goal
		(target-block-height uint)	;; target block height
	))

;; campaign information
;; could at some point be moved to Gaia
(define-map campaign-information ((campaign-id uint))
	(
		(description (buff 280))	;; campaign short description
		(link (buff 150))			;; campaign URL
	))

;; campaign aggregates
(define-map campaign-totals ((campaign-id uint))
	(
		(total-investment uint)
		(total-investors uint)
	))

;; campaign status, whether the target was reached and at what block height
(define-map campaign-status ((campaign-id uint))
	(
		(target-reached bool)		;; was the target reached?
		(target-reached-height uint);; block-height when it was reached
		(funded bool)				;; did the fundraiser collect the funds?
	))

;; tier ID nonce per campaign
(define-map tier-id-nonce ((campaign-id uint))
	(
		(nonce uint)
	))

;; fundraising tiers per campaign
(define-map tiers ((campaign-id uint) (tier-id uint))
	(
		(name (buff 32))			;; human-readable tier name
		(description (buff 200))	;; tier short description
		(cost uint)					;; tier minimum pledge cost
	))

;; tier aggregates
(define-map tier-totals ((campaign-id uint) (tier-id uint))
	(
		(total-investment uint)
		(total-investors uint)
	))

;; tier investment by principal
(define-map tier-investments ((campaign-id uint) (tier-id uint) (investor principal))
	(
		(amount uint)
	))

;; get the campaign ID nonce
(define-read-only (get-campaign-id-nonce)
	(ok (var-get campaign-id-nonce))
	)

;; get total campaigns funded
(define-read-only (get-total-campaigns-funded)
	(ok (var-get total-campaigns-funded))
	)

;; get total campaign investments
(define-read-only (get-total-investments)
	(ok (var-get total-investments))
	)

;; get total campaign investment value
(define-read-only (get-total-investment-value)
	(ok (var-get total-investment-value))
	)

;; get campaign
(define-read-only (get-campaign (campaign-id uint))
	(ok (map-get? campaigns ((campaign-id campaign-id))))
	)

;; get campaign information
(define-read-only (get-campaign-information (campaign-id uint))
	(ok (map-get? campaign-information ((campaign-id campaign-id))))
	)

;; get campaign totals
(define-read-only (get-campaign-totals (campaign-id uint))
	(ok (map-get? campaign-totals ((campaign-id campaign-id))))
	)

;; get campaign status
(define-read-only (get-campaign-status (campaign-id uint))
	(ok (map-get? campaign-status ((campaign-id campaign-id))))
	)

;; get if a campaign is active
(define-read-only (get-is-active-campaign (campaign-id uint))
	(let (
		(campaign (unwrap! (map-get? campaigns ((campaign-id campaign-id))) (ok false)))
		(status (unwrap! (map-get? campaign-status ((campaign-id campaign-id))) (ok false)))
		)
		(ok (and (< block-height (get target-block-height campaign)) (not (get target-reached status))))
		)
	)

;; get campaign tier ID nonce
(define-read-only (get-campaign-tier-nonce (campaign-id uint))
	(ok (default-to u0 (get nonce (map-get? tier-id-nonce ((campaign-id campaign-id))))))
	)

;; get campaign tier information
(define-read-only (get-campaign-tier (campaign-id uint) (tier-id uint))
	(ok (map-get? tiers ((campaign-id campaign-id) (tier-id tier-id))))
	)

;; get campaign tier totals
(define-read-only (get-campaign-tier-totals (campaign-id uint) (tier-id uint))
	(ok (map-get? tier-totals ((campaign-id campaign-id) (tier-id tier-id))))
	)

;; get the campaign tier invested amount for a principal
(define-read-only (get-campaign-tier-investment-amount (campaign-id uint) (tier-id uint) (investor principal))
	(ok (default-to u0 (get amount (map-get? tier-investments ((campaign-id campaign-id) (tier-id tier-id) (investor investor))))))
	)

;; create a new campaign for fundraising
;; it stores a little bit of information in the contract so that
;; there is a single source of truth.
;; a fundraiser should set a campaign name, description, goal in mSTX,
;; and duration in blocks.
(define-public (create-campaign (name (buff 64)) (description (buff 280)) (link (buff 150)) (goal uint) (duration uint))
	(let ((campaign-id (+ (var-get campaign-id-nonce) u1)))
		(if (and
				(map-set campaigns ((campaign-id campaign-id))
					(
						(name name)
						(fundraiser tx-sender)
						(goal goal)
						(target-block-height (+ duration block-height))
					))
				(map-set campaign-information ((campaign-id campaign-id))
					(
						(description description)
						(link link)
					))
				(map-set campaign-totals ((campaign-id campaign-id))
					(
						(total-investment u0)
						(total-investors u0)
					))
				(map-set campaign-status ((campaign-id campaign-id))
					(
						(target-reached false)
						(target-reached-height u0)
						(funded false)
					))
				)
			(begin
				(var-set campaign-id-nonce campaign-id)
				(ok campaign-id))
			error-general ;; else
			)
		)
	)

;; updates campaign information (description and link)
;; owner only
(define-public (update-campaign-information (campaign-id uint) (description (buff 280)) (link (buff 150)))
	(let ((campaign (unwrap! (map-get? campaigns ((campaign-id campaign-id))) error-campaign-does-not-exist)))
		(asserts! (is-eq (get fundraiser campaign) tx-sender) error-not-owner)
		(map-set campaign-information ((campaign-id campaign-id))
			(
				(description description)
				(link link)
			))
		(ok u1)
		)
	)

;; adds a funding tier to the campaign
;; owner only
(define-public (add-tier (campaign-id uint) (name (buff 32)) (description (buff 200)) (cost uint))
	(let ((campaign (unwrap! (map-get? campaigns ((campaign-id campaign-id))) error-campaign-does-not-exist)))
		(asserts! (is-eq (get fundraiser campaign) tx-sender) error-not-owner)
		(let ((tier-id (+ (unwrap-panic (get-campaign-tier-nonce campaign-id)) u1)))
			(if (and
					(map-set tiers ((campaign-id campaign-id) (tier-id tier-id))
						(
							(name name)
							(description description)
							(cost cost)
						))
					(map-set tier-totals ((campaign-id campaign-id) (tier-id tier-id))
						(
							(total-investment u0)
							(total-investors u0)
						))
					)
				(begin
					(map-set tier-id-nonce ((campaign-id campaign-id)) ((nonce tier-id)))
					(ok tier-id))
				error-general ;; else
				)
			)
		)
	)

;; invest in a campaign
;; transfers stx from tx-sender to the contract
(define-public (invest (campaign-id uint) (tier-id uint) (amount uint))
	(let (
		(campaign (unwrap! (map-get? campaigns ((campaign-id campaign-id))) error-campaign-does-not-exist))
		(status (unwrap-panic (map-get? campaign-status ((campaign-id campaign-id)))))
		(total (unwrap-panic (map-get? campaign-totals ((campaign-id campaign-id)))))
		(tier (unwrap-panic (map-get? tiers ((campaign-id campaign-id) (tier-id tier-id)))))
		(tier-total (unwrap-panic (map-get? tier-totals ((campaign-id campaign-id) (tier-id tier-id)))))
		(prior-investment (default-to u0 (get amount (map-get? tier-investments ((campaign-id campaign-id) (tier-id tier-id) (investor tx-sender))))))
		)
		(asserts! (and (< block-height (get target-block-height campaign)) (not (get target-reached status))) error-campaign-inactive)
		(asserts! (>= amount (get cost tier)) error-invest-amount-insufficient)
		(unwrap! (stx-transfer? amount tx-sender (as-contract tx-sender)) error-invest-stx-transfer-failed)
		(let (
			(new-campaign-total (+ (get total-investment total) amount))
			(new-tier-total (+ (get total-investment tier-total) amount))
			)
			(if (and
					(map-set campaign-totals ((campaign-id campaign-id))
						(
							(total-investment new-campaign-total)
							(total-investors (if (> prior-investment u0) (get total-investors total) (+ (get total-investors total) u1)))
						))
					(map-set tier-totals ((campaign-id campaign-id) (tier-id tier-id))
						(
							(total-investment new-tier-total)
							(total-investors (if (> prior-investment u0) (get total-investors tier-total) (+ (get total-investors tier-total) u1)))
						))
					(map-set tier-investments ((campaign-id campaign-id) (tier-id tier-id) (investor tx-sender))
						(
							(amount (+ prior-investment amount))
						))
					)
				(begin
					(var-set total-investments (+ (var-get total-investments) u1))
					(var-set total-investment-value (+ (var-get total-investment-value) amount))
					(if (>= new-campaign-total (get goal campaign))
						(begin
							(map-set campaign-status ((campaign-id campaign-id))
								(
									(target-reached true)
									(target-reached-height block-height)
									(funded false)
								))
							(var-set total-campaigns-funded (+ (var-get total-campaigns-funded) u1))
							(ok u2) ;; funded and target reached
							)
						(ok u1) ;; else: funded but target not yet reached
						)
					)
				error-general ;; else
				)
			)
		)
	)

;; refund an investment
;; can only refund if the investment target has not been reached
;; transfers stx from the contract to the tx-sender
(define-public (refund (campaign-id uint) (tier-id uint))
	(let (
		(campaign (unwrap! (map-get? campaigns ((campaign-id campaign-id))) error-campaign-does-not-exist))
		(status (unwrap-panic (map-get? campaign-status ((campaign-id campaign-id)))))
		(total (unwrap-panic (map-get? campaign-totals ((campaign-id campaign-id)))))
		(tier (unwrap-panic (map-get? tiers ((campaign-id campaign-id) (tier-id tier-id)))))
		(tier-total (unwrap-panic (map-get? tier-totals ((campaign-id campaign-id) (tier-id tier-id)))))
		(prior-investment (default-to u0 (get amount (map-get? tier-investments ((campaign-id campaign-id) (tier-id tier-id) (investor tx-sender))))))
		(original-tx-sender tx-sender)
		)
		(asserts! (not (get target-reached status)) error-campaign-already-funded)
		(asserts! (> prior-investment u0) error-no-investment)
		(unwrap! (as-contract (stx-transfer? prior-investment tx-sender original-tx-sender)) error-refund-stx-transfer-failed)
		(let (
			(new-campaign-total (- (get total-investment total) prior-investment))
			(new-tier-total (- (get total-investment tier-total) prior-investment))
			)
			(if (and
					(map-set campaign-totals ((campaign-id campaign-id))
						(
							(total-investment new-campaign-total)
							(total-investors (- (get total-investors total) u1))
						))
					(map-set tier-totals ((campaign-id campaign-id) (tier-id tier-id))
						(
							(total-investment new-tier-total)
							(total-investors (- (get total-investors tier-total) u1))
						))
					(map-delete tier-investments ((campaign-id campaign-id) (tier-id tier-id) (investor tx-sender)))
					)
				(begin
					(var-set total-investments (- (var-get total-investments) u1))
					(var-set total-investment-value (- (var-get total-investment-value) prior-investment))
					(ok u1)
					)
				error-general ;; else
				)
			)
		)
	)

;; fund a campaign
;; this sends the raised funds to the fundraiser
;; only works if the goal was reached within the specified duration
;; TODO: allow other senders to trigger the stx transfer to the fundraiser?
;; TODO: transfer optional collection fee to contract-owner
(define-public (collect (campaign-id uint))
	(let (
		(campaign (unwrap! (map-get? campaigns ((campaign-id campaign-id))) error-campaign-does-not-exist))
		(status (unwrap-panic (map-get? campaign-status ((campaign-id campaign-id)))))
		(total (unwrap-panic (map-get? campaign-totals ((campaign-id campaign-id)))))
		(original-tx-sender tx-sender)
		)
		(asserts! (is-eq (get fundraiser campaign) tx-sender) error-not-owner)
		(asserts! (not (get funded status)) error-already-funded)
		(asserts! (get target-reached status) error-target-not-reached)
		(unwrap! (as-contract (stx-transfer? (get total-investment total) tx-sender original-tx-sender)) error-funding-stx-transfer-failed)
		(asserts! (map-set campaign-status ((campaign-id campaign-id))
			(
				(target-reached true)
				(target-reached-height (get target-reached-height status))
				(funded true)
			)) error-general)
		(ok u1)
		)
	)
