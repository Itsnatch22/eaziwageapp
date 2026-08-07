@[.agents/skills/api-designer] in @[app/api/auth/login] the max failed attempts isn't correctly implemented. User gets locked out after at most 2 attempts

@[lib/stanbic] keeps logging a *ResponseCode=uknown*, it's worth cheking the Stanbic swagger example in `/public/Account_Transactions_History_API_Sandbox.-1.0.0.json`

@[/app/admin/bank-verifications] should match the UI from related pages, it looks like it's in a world of its own