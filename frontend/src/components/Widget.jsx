import { usePlugins } from '../context/PluginContext'

const Widgets = () => {
  const { plugins } = usePlugins()

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center">


        <div className="flex items-center gap-4">
          {plugins.map((Plugin, idx) => (
            <Plugin key={idx} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Widgets
