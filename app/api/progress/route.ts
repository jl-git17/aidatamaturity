export async function POST(request: Request) {
  const formData = await request.formData()
  const runId = formData.get("run_id")

  const backendFormData = new FormData()
  if (runId) backendFormData.append("run_id", runId as string)

  const response = await fetch(
    `${process.env.BACKEND_URL}/microsites/execution/progress`,
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
