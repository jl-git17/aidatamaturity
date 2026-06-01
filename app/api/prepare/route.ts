export async function POST(req: Request) {
  const formData = await req.formData()
  const dataFile = formData.get("data_file")
  const fileContext = formData.get("file_context") as string || ""

  const fd = new FormData()
  if (dataFile) fd.append("data_file", dataFile as File)
  fd.append("file_context", fileContext)

  const url = process.env.BACKEND_URL + "/microsites/execution/ai-data-maturity/prepare"
  const key = process.env.API_KEY + ""

  const res = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": key },
    body: fd,
  })

  const json = await res.json()
  return Response.json(json, { status: res.status })
}
