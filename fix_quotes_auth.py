import re

with open('server/routers/quotes.ts', 'r') as f:
    content = f.read()

# The remaining pattern is always:
#       const clientId = (ctx.user as any).portalClientId as number | undefined;
#       if (!clientId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required" });
# (6 spaces indent for nested procedures)

old_pattern = r"      const clientId = \(ctx\.user as any\)\.portalClientId as number \| undefined;\n      if \(!clientId\) throw new TRPCError\(\{ code: \"UNAUTHORIZED\", message: \"Portal session required\" \}\);"
new_pattern = '      const portalAuth = await getPortalClient(ctx.req);\n      if (!portalAuth) throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal session required" });\n      const clientId = portalAuth.client.id;'

content = re.sub(old_pattern, new_pattern, content)

# Also replace getCrmClientById(clientId) with portalAuth.client (6-space indent version)
content = content.replace(
    '        const client = await getCrmClientById(clientId);\n        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Client not found" });',
    '        const client = portalAuth.client;'
)

with open('server/routers/quotes.ts', 'w') as f:
    f.write(content)

remaining = content.count('portalClientId')
print(f"Done. Remaining portalClientId references: {remaining}")
