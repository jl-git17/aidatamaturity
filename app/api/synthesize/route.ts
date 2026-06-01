export async function POST(request: Request) {
  const formData = await request.formData()

  const backendFormData = new FormData()
  const columnResults = formData.get("column_results")
  const fileName = formData.get("file_name")
  const fileContext = formData.get("file_context")

  if (columnResults) backendFormData.append("column_results", columnResults as string)
  if (fileName) backendFormData.append("file_name", fileName as string)
  if (fileContext) backendFormData.append("file_context", fileContext as string)

  const response = await fetch(
    `${process.env.BACKEND_URL}/microsites/execution/ai-data-maturity/synthesize`,
    {
      method: "POST",
      headers: {
        "x-api-key": process.env.API_KEY!,
      },
      body: backendFormData,
    }
  )

  const data = await response.json()
  return Response.json(data, { status: response.status })
}
